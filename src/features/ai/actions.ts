'use server'

import { revalidatePath } from 'next/cache'
import { recordActivity } from '@/features/collaboration/lib/activity'
import { createClient } from '@/lib/supabase/server'
import type {
  ScheduleAnalysisReport,
  ScheduleDiagnosticIssue,
  ScheduleHealthScore,
  ScheduleProposalScenario,
} from './types'
import { loadSchedule } from '@/features/scheduling/lib/load-schedule'
import { detectScheduleConflicts } from '@/features/scheduling/lib/conflict-detector'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import { doodStatusForDay } from '@/features/reports/lib/dood-status'
import { countCompanyMoves, planLocationClusters, planTurnaroundFixes } from './lib/schedule-planner'

const scenePages = (s: { page_start: number | null; page_end: number | null }) =>
  Math.max(0.125, Number(s.page_end ?? s.page_start ?? 0) - Number(s.page_start ?? 0))

async function loadContext(projectId: string) {
  const supabase = await createClient()
  const [{ data: project }, schedule, { data: settings }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', projectId).single(),
    loadSchedule(supabase, projectId),
    supabase.from('project_settings').select('max_shooting_hours').eq('project_id', projectId).maybeSingle(),
  ])
  if (!project) throw new Error('Project not found')
  const maxMinutes = Math.round(Number(settings?.max_shooting_hours ?? 12) * 60)
  return { supabase, project, schedule, maxMinutes }
}

/**
 * Schedule health from the real schedule. Turnaround and flip-flop findings come from the same
 * conflict engine the stripboard uses, so both screens always agree.
 */
export async function analyzeScheduleHealthAction(projectId: string): Promise<ScheduleAnalysisReport> {
  const { supabase, project, schedule, maxMinutes } = await loadContext(projectId)
  const days = schedule.shootDays
  const diagnostics: ScheduleDiagnosticIssue[] = []

  let workloadPenalties = 0
  let locationPenalties = 0
  let turnaroundPenalties = 0

  days.forEach((day, idx) => {
    const dayNum = day.day_number || idx + 1
    const hours = day.totalEstimatedMinutes / 60
    if (day.totalEstimatedMinutes > maxMinutes) {
      workloadPenalties += 25
      diagnostics.push({
        id: `overload-${day.id}`,
        severity: 'CRITICAL',
        category: 'OVERLOAD',
        title: `Over-scheduled Shoot Day ${dayNum}`,
        description: `Day ${dayNum} is planned at ${hours.toFixed(1)} hours, above the ${maxMinutes / 60}h limit in project settings.`,
        impact: 'Overtime penalties and crew fatigue.',
        suggestedAction: 'Move scenes to a lighter day or add a shoot day.',
      })
    } else if (day.totalEstimatedMinutes > maxMinutes * 0.85) {
      workloadPenalties += 10
      diagnostics.push({
        id: `heavy-${day.id}`,
        severity: 'WARNING',
        category: 'OVERLOAD',
        title: `Heavy Workload on Day ${dayNum}`,
        description: `Day ${dayNum} is planned at ${hours.toFixed(1)} hours.`,
        impact: 'Little buffer for delays.',
        suggestedAction: 'Hard-schedule the meal break at the 6-hour mark.',
      })
    }

    const locations = Array.from(new Set(day.scenes.map((s) => (s.scene.location_name || '').trim()).filter(Boolean)))
    if (locations.length > 3) {
      locationPenalties += 25
      diagnostics.push({
        id: `loc-move-${day.id}`,
        severity: 'WARNING',
        category: 'LOCATION_MOVE',
        title: `High Company Move Count on Day ${dayNum}`,
        description: `Day ${dayNum} uses ${locations.length} locations (${locations.join(', ')}).`,
        impact: 'Each company move costs setup time.',
        suggestedAction: 'Consolidate scenes by location onto dedicated days.',
      })
    }
  })

  for (const c of detectScheduleConflicts(days)) {
    if (c.type === 'TURNAROUND') {
      turnaroundPenalties += 30
      diagnostics.push({
        id: c.id,
        severity: 'CRITICAL',
        category: 'TURNAROUND',
        title: c.title,
        description: c.description,
        impact: 'Violates the 12-hour turnaround rule (forced-call penalties).',
        suggestedAction: c.quickFix?.label || 'Push the next call time later.',
      })
    } else if (c.type === 'FLIP_FLOP') {
      turnaroundPenalties += 10
      diagnostics.push({
        id: c.id,
        severity: 'WARNING',
        category: 'DAY_NIGHT_FLIP',
        title: c.title,
        description: c.description,
        impact: 'Crew fatigue from a night-to-day switch.',
        suggestedAction: 'Add a turnaround day or move the day scenes later.',
      })
    }
  }

  if (schedule.unscheduledScenes.length > 0) {
    diagnostics.push({
      id: 'unscheduled-pool',
      severity: 'TIP',
      category: 'UNSCHEDULED_POOL',
      title: `${schedule.unscheduledScenes.length} Unscheduled Scenes in Pool`,
      description: `${schedule.unscheduledScenes.length} scenes are not placed on a shoot day yet.`,
      impact: 'The schedule is incomplete until every scene is placed.',
      suggestedAction: 'Use Smart Auto-Schedule or drag the remaining scenes onto shoot days.',
    })
  }

  // Cast hold efficiency from real bookings: share of paid days that are holds rather than work
  const { data: bookings } = await supabase.from('resource_bookings').select('shoot_day_id, resource_id').eq('project_id', projectId)
  const dayIndex = new Map(days.map((d, i) => [d.id, i]))
  const workedByResource = new Map<string, number[]>()
  for (const b of bookings || []) {
    const i = dayIndex.get(b.shoot_day_id)
    if (i === undefined) continue
    workedByResource.set(b.resource_id, [...(workedByResource.get(b.resource_id) || []), i])
  }
  let work = 0
  let hold = 0
  for (const indices of workedByResource.values()) {
    const sorted = [...new Set(indices)].sort((a, b) => a - b)
    days.forEach((_, i) => {
      const st = doodStatusForDay(sorted, i)
      if (st === 'H') hold++
      else if (st) work++
    })
  }
  if (hold > 0 && work > 0 && hold / (work + hold) > 0.2) {
    diagnostics.push({
      id: 'excessive-holds',
      severity: 'WARNING',
      category: 'EXCESSIVE_HOLD',
      title: `${hold} paid hold days`,
      description: `${Math.round((hold / (work + hold)) * 100)}% of booked cast & crew days are holds between work days.`,
      impact: 'Hold days are paid without shooting.',
      suggestedAction: 'Group each actor’s scenes onto consecutive days.',
    })
  }

  const turnaroundSafetyScore = Math.max(0, Math.min(100, 100 - turnaroundPenalties))
  const workloadBalanceScore = Math.max(0, Math.min(100, 100 - workloadPenalties))
  const locationEfficiencyScore = Math.max(0, Math.min(100, 100 - locationPenalties))
  const castHoldEfficiencyScore = work + hold > 0 ? Math.round((work / (work + hold)) * 100) : 100
  const overallScore = Math.round(
    turnaroundSafetyScore * 0.35 + workloadBalanceScore * 0.25 + locationEfficiencyScore * 0.25 + castHoldEfficiencyScore * 0.15
  )
  const healthScore: ScheduleHealthScore = {
    overallScore,
    turnaroundSafetyScore,
    workloadBalanceScore,
    locationEfficiencyScore,
    castHoldEfficiencyScore,
  }

  const recommendations: string[] = []
  if (days.length === 0) recommendations.push('Create shoot days and place scenes to get a health score.')
  else if (diagnostics.some((d) => d.severity === 'CRITICAL'))
    recommendations.push('Resolve the critical issues before publishing call sheets.')
  else if (overallScore >= 85) recommendations.push('No blocking issues found. Ready for call sheets.')
  else recommendations.push('Review heavy days and company moves to tighten the schedule.')

  const totalMinutes = days.reduce((m, d) => m + d.totalEstimatedMinutes, 0)
  const placedScenes = days.flatMap((d) => d.scenes)
  return {
    projectId,
    projectName: project.name,
    healthScore,
    diagnostics,
    recommendations,
    metricsSummary: {
      totalShootDays: days.length,
      totalScenes: placedScenes.length,
      totalPages: `${placedScenes.reduce((p, s) => p + scenePages(s.scene), 0).toFixed(1)} pgs`,
      avgHoursPerDay: days.length ? Math.round((totalMinutes / 60 / days.length) * 10) / 10 : 0,
      totalLocationMoves: countCompanyMoves(days),
    },
  }
}

/** Proposals computed from the current schedule; only ones that improve something are returned. */
export async function generateScheduleProposalsAction(projectId: string): Promise<ScheduleProposalScenario[]> {
  const { schedule, maxMinutes } = await loadContext(projectId)
  const days = schedule.shootDays
  const proposals: ScheduleProposalScenario[] = []

  const cluster = planLocationClusters(days, maxMinutes)
  if (cluster.movesAfter < cluster.movesBefore || cluster.emptiedDays > 0) {
    proposals.push({
      id: 'prop-location-cluster',
      title: 'Cluster scenes by location',
      tagline: `Company moves ${cluster.movesBefore} → ${cluster.movesAfter}`,
      category: 'LOCATION_CLUSTER',
      daysSaved: cluster.emptiedDays,
      companyMovesRemoved: cluster.movesBefore - cluster.movesAfter,
      healthScoreImprovement: Math.min(25, (cluster.movesBefore - cluster.movesAfter) * 5),
      summary: `Re-packs the scenes on unlocked days so each location is shot in one block, filling days in date order up to ${maxMinutes / 60}h. Locked days are untouched.`,
      changes: [
        `Company moves: ${cluster.movesBefore} → ${cluster.movesAfter}`,
        ...(cluster.emptiedDays > 0 ? [`${cluster.emptiedDays} day(s) become empty and can be deleted`] : []),
        'Scene order within each location follows the current schedule.',
      ],
      proposedShootDays: cluster.days.map((d) => ({
        day_number: d.dayNumber,
        location_summary: d.locations.join(' · ') || '(empty)',
        scene_count: d.sceneCount,
        estimated_hours: Math.round((d.minutes / 60) * 10) / 10,
      })),
    })
  }

  const fixes = planTurnaroundFixes(days)
  if (fixes.length > 0) {
    proposals.push({
      id: 'prop-turnaround',
      title: 'Fix turnaround call times',
      tagline: `Clears ${fixes.length} 12-hour turnaround violation(s)`,
      category: 'BALANCED_TURNAROUND',
      daysSaved: 0,
      companyMovesRemoved: 0,
      healthScoreImprovement: Math.min(35, fixes.length * 10),
      summary: 'Moves the next-day call time later so every day gets 12 hours of rest after the previous wrap.',
      changes: fixes.map((f) => `Day ${f.dayNumber}: call time → ${f.newCallTime}`),
      proposedShootDays: days.map((d, i) => ({
        day_number: d.day_number || i + 1,
        location_summary: fixes.find((f) => f.dayId === d.id)
          ? `CALL ${fixes.find((f) => f.dayId === d.id)!.newCallTime}`
          : `CALL ${d.call_time?.slice(0, 5) || '—'}`,
        scene_count: d.scenes.length,
        estimated_hours: Math.round((d.totalEstimatedMinutes / 60) * 10) / 10,
      })),
    })
  }

  return proposals
}

/** Re-computes the chosen proposal from the saved schedule and applies it. */
export async function applyScheduleProposalAction(projectId: string, proposalId: string) {
  try {
    const { supabase, schedule, maxMinutes } = await loadContext(projectId)

    if (proposalId === 'prop-location-cluster') {
      const plan = planLocationClusters(schedule.shootDays, maxMinutes)
      for (const day of schedule.shootDays.filter((d) => !d.is_locked)) {
        const { error } = await supabase.from('shoot_day_scenes').delete().eq('shoot_day_id', day.id)
        if (error) throw new Error(error.message)
        const rows = (plan.assignments.get(day.id) || []).map((sceneId, i) => {
          const prev = day.scenes.find((s) => s.scene.id === sceneId) ||
            schedule.shootDays.flatMap((d) => d.scenes).find((s) => s.scene.id === sceneId)
          return { shoot_day_id: day.id, scene_id: sceneId, sort_order: i + 1, estimated_minutes: prev?.estimatedMinutes ?? null }
        })
        if (rows.length) {
          const { error: insErr } = await supabase.from('shoot_day_scenes').insert(rows)
          if (insErr) throw new Error(insErr.message)
        }
      }
      await syncProjectBookings(supabase, projectId)
    } else if (proposalId === 'prop-turnaround') {
      for (const fix of planTurnaroundFixes(schedule.shootDays)) {
        const { error } = await supabase.from('shoot_days').update({ call_time: fix.newCallTime }).eq('id', fix.dayId)
        if (error) throw new Error(error.message)
      }
    } else {
      return { error: 'Unknown proposal' }
    }

    await recordActivity(
      projectId,
      'PROPOSAL_APPLIED',
      proposalId === 'prop-location-cluster' ? 'Re-grouped scenes by location' : 'Fixed turnaround call times'
    )
    revalidatePath(`/projects/${projectId}/schedule`)
    revalidatePath(`/projects/${projectId}/callsheets`)
    return { success: 'Proposal applied to the schedule.' }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Failed to apply schedule proposal' }
  }
}
