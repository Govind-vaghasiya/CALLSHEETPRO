'use client'

import { createClient } from '@/lib/supabase/client'
import type { Database, ShootDayStatus } from '@/types/database'
import type { ProjectScheduleData, ShootDayWithScenes } from '../actions'
import type { ScheduleConstraints } from './availability-conflicts'
import { BLOCKING_STATUSES, windowRangeOnDate } from '@/features/availability/lib/windows'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import { saveScheduleVersionAction } from '@/features/versioning/actions'
import { logActivityAction } from '@/features/collaboration/actions'
import { cleanLocationName, locationSite } from './location-key'
import type { DayPart, PlannerScene, PlanResult } from './auto-schedule'
import type { ProductionCalendar } from './production-calendar'
import { loadProductionCalendar, renumberDaysByDate } from './production-calendar-run'

type SceneRow = Database['public']['Tables']['scenes']['Row']

/** Notes prefix on days this feature (or the old Auto-Group) created — only those are ever rebuilt. */
export const AUTO_NOTE = 'Auto-scheduled'
const isAutoDay = (d: ShootDayWithScenes) => /^Auto-(grouped|scheduled)/.test(d.notes || '')
const EDITABLE: ShootDayStatus[] = ['DRAFT', 'PLANNED']

export const NIGHT_CALL = '18:00:00'
export const NIGHT_WRAP = '06:00:00'

export interface AutoScheduleContext {
  projectStart: string | null
  dayCall: string
  dayWrap: string | null
  maxShootMinutes: number
  companyMoveMinutes: number
  /** Characters of script text per printed page (from this project's script) */
  charsPerPage: number
  /** Days this feature may delete: empty ones, and (when rebuilding) earlier auto days */
  emptyDayIds: string[]
  autoDayIds: string[]
  /** Shooting has started — day numbers are fixed, new days are numbered after the last one */
  numbersFixed: boolean
  /** Work week + holidays from the production calendar */
  calendar: ProductionCalendar
}

/** Project settings, script length calibration, and which days are safe to remove. */
export async function loadAutoScheduleContext(projectId: string, schedule: ProjectScheduleData): Promise<AutoScheduleContext> {
  const sb = createClient()
  const [{ data: project }, { data: settings }, { data: sheets }, { data: docs }] = await Promise.all([
    sb.from('projects').select('start_date').eq('id', projectId).single(),
    sb
      .from('project_settings')
      .select('default_call_time, default_wrap_time, max_shooting_hours, company_move_threshold')
      .eq('project_id', projectId)
      .maybeSingle(),
    sb.from('call_sheets').select('shoot_day_id').eq('project_id', projectId),
    sb.from('script_documents').select('id').eq('project_id', projectId).eq('is_current', true).limit(1),
  ])

  const calendar = await loadProductionCalendar(sb, projectId)
  let charsPerPage = 1500
  if (docs?.[0]) {
    const { data: pages } = await sb.from('script_pages').select('raw_text').eq('script_document_id', docs[0].id)
    const filled = (pages || []).filter((p) => (p.raw_text || '').trim())
    const chars = filled.reduce((n, p) => n + (p.raw_text || '').length, 0)
    if (filled.length >= 3 && chars > 0) charsPerPage = chars / filled.length
  }

  const withSheet = new Set((sheets || []).map((s) => s.shoot_day_id))
  const removable = (d: ShootDayWithScenes) => EDITABLE.includes(d.status) && !d.is_locked && !withSheet.has(d.id)

  return {
    projectStart: project?.start_date ?? null,
    dayCall: settings?.default_call_time || '07:00:00',
    dayWrap: settings?.default_wrap_time || null,
    maxShootMinutes: Math.round(Number(settings?.max_shooting_hours || 10) * 60),
    companyMoveMinutes: Number(settings?.company_move_threshold ?? 30),
    charsPerPage,
    emptyDayIds: schedule.shootDays.filter((d) => d.scenes.length === 0 && removable(d)).map((d) => d.id),
    autoDayIds: schedule.shootDays.filter((d) => d.scenes.length > 0 && isAutoDay(d) && removable(d)).map((d) => d.id),
    numbersFixed: schedule.shootDays.some((d) => d.status === 'IN_PROGRESS' || d.status === 'COMPLETED'),
    calendar: { workDays: calendar.workDays, holidays: calendar.holidays },
  }
}

/** Scene → what the planner needs to know about it. */
export function toPlannerScenes(
  schedule: ProjectScheduleData,
  sceneIds: Set<string>,
  constraints: ScheduleConstraints,
  charsPerPage: number
): PlannerScene[] {
  const all: SceneRow[] = [...schedule.shootDays.flatMap((d) => d.scenes.map((s) => s.scene)), ...schedule.unscheduledScenes].sort(
    (a, b) => (a.scene_order ?? 0) - (b.scene_order ?? 0)
  )

  // "LATER" / "CONTINUOUS" scenes happen at the same time of day as the scene before them
  const partOf = new Map<string, DayPart>()
  let last: DayPart = 'DAY'
  for (const s of all) {
    const tod = s.time_of_day
    if (tod === 'NIGHT') last = 'NIGHT'
    else if (tod === 'DAY' || tod === 'DAWN' || tod === 'DUSK') last = 'DAY'
    partOf.set(s.id, last)
  }

  return all
    .filter((s) => sceneIds.has(s.id))
    .map((s) => {
      const needs = constraints.needsByScene.get(s.id) || []
      const locations = needs.filter((n) => n.type === 'LOCATION')
      const set = cleanLocationName(locations.length === 1 ? locations[0].name : s.location_name || s.heading)
      const textLength = (s.description || '').length
      return {
        id: s.id,
        number: s.scene_number,
        order: s.scene_order ?? 0,
        set,
        site: locationSite(set),
        location: s.location_name,
        part: partOf.get(s.id) || 'DAY',
        eighths: Math.max(1, Math.round((textLength / charsPerPage) * 8)),
        minutes: s.estimated_duration || 30,
        cast: needs.filter((n) => n.type === 'PERSON' && n.character).map((n) => n.resourceId),
        needs: needs.map((n) => n.resourceId),
      }
    })
}

/** True when the resource is out for the whole date (hour-level clashes are flagged afterwards). */
export function allDayBlocker(constraints: ScheduleConstraints) {
  return (resourceId: string, date: string) =>
    constraints.windows.some(
      (w) =>
        w.resource_id === resourceId &&
        BLOCKING_STATUSES.includes(w.status) &&
        (() => {
          const r = windowRangeOnDate(w, date)
          return !!r && r[0] === 0 && r[1] === 1440
        })()
    )
}

/** Planned days as stripboard days, so the existing conflict checks can review the plan. */
export function planAsShootDays(
  plan: PlanResult,
  schedule: ProjectScheduleData,
  ctx: AutoScheduleContext,
  projectId: string,
  dayNumbers: number[] = []
): ShootDayWithScenes[] {
  const rows = new Map<string, SceneRow>(
    [...schedule.shootDays.flatMap((d) => d.scenes.map((s) => s.scene)), ...schedule.unscheduledScenes].map((s) => [s.id, s])
  )
  return plan.days.map((d, i) => {
    const scenes = d.sceneIds.map((id, j) => {
      const scene = rows.get(id)!
      return { assignmentId: `plan-${i}-${j}`, scene, sortOrder: j + 1, estimatedMinutes: scene.estimated_duration || 30, fixedStartTime: null }
    })
    return {
      id: `plan-${i}`,
      project_id: projectId,
      shoot_date: d.date,
      day_number: dayNumbers[i] ?? i + 1,
      call_time: d.part === 'NIGHT' ? NIGHT_CALL : ctx.dayCall,
      wrap_time: d.part === 'NIGHT' ? NIGHT_WRAP : ctx.dayWrap,
      status: 'PLANNED',
      primary_location_id: null,
      notes: null,
      is_locked: false,
      created_by: null,
      created_at: '',
      updated_at: '',
      scenes,
      totalEstimatedMinutes: scenes.reduce((m, s) => m + s.estimatedMinutes, 0),
    } as ShootDayWithScenes
  })
}

/**
 * Save the plan: backup version → remove the chosen days → create the planned days with their
 * scenes → number days by date → re-derive bookings.
 */
export async function applyAutoSchedule(
  projectId: string,
  plan: PlanResult,
  ctx: AutoScheduleContext,
  deleteDayIds: string[],
  schedule: ProjectScheduleData
): Promise<{ success: boolean; error?: string; createdDays: number }> {
  const sb = createClient()
  const backup = await saveScheduleVersionAction(
    projectId,
    'Before: Smart Auto-Schedule',
    'WHITE',
    'Automatic backup before Smart Auto-Schedule'
  )
  if (!backup.success) return { success: false, error: backup.error || 'Could not save a backup version', createdDays: 0 }

  for (let i = 0; i < deleteDayIds.length; i += 100) {
    const { error } = await sb.from('shoot_days').delete().in('id', deleteDayIds.slice(i, i + 100))
    if (error) return { success: false, error: `Could not remove old days: ${error.message}`, createdDays: 0 }
  }

  const removed = new Set(deleteDayIds)
  const keptMax = schedule.shootDays.filter((d) => !removed.has(d.id)).reduce((m, d) => Math.max(m, d.day_number || 0), 0)
  const { data: created, error: dayError } = await sb
    .from('shoot_days')
    .insert(
      plan.days.map((d, i) => ({
        project_id: projectId,
        shoot_date: d.date,
        day_number: keptMax + i + 1,
        call_time: d.part === 'NIGHT' ? NIGHT_CALL : ctx.dayCall,
        wrap_time: d.part === 'NIGHT' ? NIGHT_WRAP : ctx.dayWrap,
        status: 'PLANNED' as ShootDayStatus,
        notes: `${AUTO_NOTE}${d.part === 'NIGHT' ? ' (night)' : ''}: ${d.sets.join(', ')}`.slice(0, 500),
        is_locked: false,
      }))
    )
    .select('id, shoot_date')
  if (dayError || !created) return { success: false, error: dayError?.message || 'Could not create shoot days', createdDays: 0 }

  const idByDate = new Map(created.map((d) => [d.shoot_date, d.id]))
  const minutesOf = new Map(
    [...schedule.shootDays.flatMap((d) => d.scenes.map((s) => [s.scene.id, s.estimatedMinutes ?? null] as const)), ...schedule.unscheduledScenes.map((s) => [s.id, null] as const)]
  )
  const assignments = plan.days.flatMap((d) =>
    d.sceneIds.map((sceneId, j) => ({
      shoot_day_id: idByDate.get(d.date)!,
      scene_id: sceneId,
      sort_order: j + 1,
      // keep minutes the AD adjusted on a rebuilt day
      estimated_minutes: minutesOf.get(sceneId) ?? null,
    }))
  )
  for (let i = 0; i < assignments.length; i += 200) {
    const { error } = await sb.from('shoot_day_scenes').insert(assignments.slice(i, i + 200))
    if (error) return { success: false, error: `Days were created but scenes could not be placed: ${error.message}`, createdDays: created.length }
  }

  if (!ctx.numbersFixed) await renumberDaysByDate(sb, projectId)

  await syncProjectBookings(sb, projectId)
  logActivityAction(
    projectId,
    'SCHEDULE_MOVE',
    `Smart Auto-Schedule: ${created.length} shoot days`,
    deleteDayIds.length ? `Removed ${deleteDayIds.length} old/empty days` : undefined
  )
  return { success: true, createdDays: created.length }
}

/** Remove empty days only (no planning). Backup first; numbering follows dates afterwards. */
export async function removeEmptyDays(projectId: string, ctx: AutoScheduleContext): Promise<{ success: boolean; error?: string }> {
  if (!ctx.emptyDayIds.length) return { success: true }
  const sb = createClient()
  const backup = await saveScheduleVersionAction(projectId, 'Before: remove empty days', 'WHITE', 'Automatic backup')
  if (!backup.success) return { success: false, error: backup.error || 'Could not save a backup version' }
  for (let i = 0; i < ctx.emptyDayIds.length; i += 100) {
    const { error } = await sb.from('shoot_days').delete().in('id', ctx.emptyDayIds.slice(i, i + 100))
    if (error) return { success: false, error: error.message }
  }
  if (!ctx.numbersFixed) await renumberDaysByDate(sb, projectId)
  logActivityAction(projectId, 'SCHEDULE_MOVE', `Removed ${ctx.emptyDayIds.length} empty shoot days`)
  return { success: true }
}
