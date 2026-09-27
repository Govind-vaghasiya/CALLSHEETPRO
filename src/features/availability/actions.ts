'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityStatus, Database, ResourceType } from '@/types/database'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import type { AvailabilityGridData, AvailabilityImpactReport, ResourceAvailabilityRow, ResourceAvailabilityWindow } from './types'
import { loadSchedule } from '@/features/scheduling/lib/load-schedule'
import { loadScheduleConstraints } from '@/features/scheduling/lib/schedule-constraints'
import { detectAvailabilityConflicts } from '@/features/scheduling/lib/availability-conflicts'
import { clockToMinutes, minutesToLabel } from '@/features/scheduling/lib/time'
import { availabilityOnDate, getProjectTimeZone, loadAvailabilityWindows, windowToStorage } from './lib/windows'

type Client = SupabaseClient<Database>

export async function getAvailabilityDataAction(projectId: string): Promise<AvailabilityGridData> {
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, start_date, target_end_date')
    .eq('id', projectId)
    .single()

  if (!project) {
    throw new Error('Project not found')
  }

  const [{ data: shootDays }, { data: resources }, { data: bookings }, windows] = await Promise.all([
    supabase
      .from('shoot_days')
      .select('id, day_number, shoot_date, is_locked')
      .eq('project_id', projectId)
      .order('shoot_date', { ascending: true }),
    supabase
      .from('resources')
      .select('id, name, display_name, resource_type, notes')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    supabase.from('resource_bookings').select('shoot_day_id, resource_id, scene_id').eq('project_id', projectId),
    loadAvailabilityWindows(supabase, projectId),
  ])

  // Date range: every shoot day, plus the project's planned span
  const datesSet = new Set<string>((shootDays || []).map((sd) => sd.shoot_date).filter(Boolean))
  if (project.start_date && project.target_end_date) {
    const curr = new Date(`${project.start_date}T00:00:00Z`)
    const end = new Date(`${project.target_end_date}T00:00:00Z`)
    while (curr <= end) {
      datesSet.add(curr.toISOString().slice(0, 10))
      curr.setUTCDate(curr.getUTCDate() + 1)
    }
  }
  if (datesSet.size === 0) {
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      datesSet.add(d.toISOString().slice(0, 10))
    }
  }

  const resourceRows: ResourceAvailabilityRow[] = (resources || []).map((res) => ({
    resource_id: res.id,
    resource_name: res.name,
    display_name: res.display_name,
    resource_type: res.resource_type,
    department_name: res.notes || undefined,
    availability_windows: windows.filter((w) => w.resource_id === res.id),
    bookings: (bookings || [])
      .filter((b) => b.resource_id === res.id)
      .map((b) => {
        const sd = (shootDays || []).find((s) => s.id === b.shoot_day_id)
        return {
          shoot_day_id: b.shoot_day_id,
          day_number: sd?.day_number || 1,
          shoot_date: sd?.shoot_date || '',
          scene_id: b.scene_id || undefined,
        }
      }),
  }))

  return {
    project_id: projectId,
    project_name: project.name,
    start_date: project.start_date,
    target_end_date: project.target_end_date,
    dates: Array.from(datesSet).sort(),
    shoot_days: (shootDays || []).map((sd) => ({
      id: sd.id,
      day_number: sd.day_number || 1,
      shoot_date: sd.shoot_date,
      is_locked: sd.is_locked,
    })),
    resources: resourceRows,
  }
}

export async function saveAvailabilityWindowAction(data: {
  projectId: string
  id?: string
  resource_id: string
  resource_name: string
  resource_type: ResourceType
  start_date: string
  end_date: string
  /** false = specific hours on those dates */
  all_day?: boolean
  start_time?: string | null
  end_time?: string | null
  status: AvailabilityStatus
  notes?: string
}) {
  const allDay = data.all_day !== false
  if (data.end_date < data.start_date) {
    return { error: 'End date must be on or after the start date.' }
  }
  if (!allDay) {
    if (!data.start_time || !data.end_time) return { error: 'Enter both a start and an end time.' }
    if (data.start_date === data.end_date && data.end_time <= data.start_time) {
      return { error: 'End time must be after the start time.' }
    }
  }

  const supabase = await createClient()
  const timeZone = await getProjectTimeZone(supabase, data.projectId)
  const interval = windowToStorage(
    { start_date: data.start_date, end_date: data.end_date, all_day: allDay, start_time: data.start_time, end_time: data.end_time },
    timeZone
  )
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const payload = {
    project_id: data.projectId,
    resource_id: data.resource_id,
    ...interval,
    status: data.status,
    notes: data.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = data.id
    ? await supabase.from('resource_availability').update(payload).eq('id', data.id)
    : await supabase.from('resource_availability').insert({ ...payload, created_by: user?.id ?? null })

  if (error) return { error: error.message }

  revalidatePath(`/projects/${data.projectId}/availability`)
  revalidatePath(`/projects/${data.projectId}/reports`)
  return { success: 'Availability window saved successfully' }
}

export async function deleteAvailabilityWindowAction(projectId: string, windowId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('resource_availability').delete().eq('id', windowId)
  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}/availability`)
  revalidatePath(`/projects/${projectId}/reports`)
  return { success: 'Availability window removed' }
}

/** Availability of one resource on one date (used by schedule checks). */
export async function getResourceAvailabilityForDate(
  projectId: string,
  resourceId: string,
  dateStr: string
): Promise<{ isAvailable: boolean; status: AvailabilityStatus; notes?: string }> {
  const supabase = await createClient()
  const windows = await loadAvailabilityWindows(supabase, projectId)
  return availabilityOnDate(windows, resourceId, dateStr)
}

/**
 * Time-aware impact of a (possibly hypothetical) unavailability window: runs the same checks as
 * the stripboard against the saved schedule, with only this window applied.
 */
async function computeImpact(
  sb: Client,
  projectId: string,
  resourceId: string,
  startDate: string,
  endDate: string,
  startTime?: string | null,
  endTime?: string | null
) {
  const schedule = await loadSchedule(sb, projectId)
  const constraints = await loadScheduleConstraints(
    sb,
    projectId,
    schedule.shootDays.flatMap((d) => d.scenes.map((s) => s.scene.id)),
    schedule.shootDays.map((d) => d.id)
  )
  const allDay = !startTime || !endTime
  const window: ResourceAvailabilityWindow = {
    id: 'impact-check',
    resource_id: resourceId,
    resource_name: '',
    resource_type: 'PERSON',
    start_date: startDate,
    end_date: endDate,
    all_day: allDay,
    start_time: allDay ? null : startTime!,
    end_time: allDay ? null : endTime!,
    status: 'UNAVAILABLE',
    notes: null,
    created_at: '',
  }
  const { conflicts, timelines } = detectAvailabilityConflicts(schedule.shootDays, { ...constraints, windows: [window] })
  const mine = conflicts.filter((c) => c.id.includes('impact-check'))
  return { schedule, timelines, hits: mine.filter((c) => c.severity === 'CRITICAL'), warnings: mine.filter((c) => c.severity === 'WARNING') }
}

export async function calculateAvailabilityImpactAction(
  projectId: string,
  resourceId: string,
  startDate: string,
  endDate: string,
  startTime?: string | null,
  endTime?: string | null
): Promise<AvailabilityImpactReport> {
  const supabase = await createClient()

  const { data: resource } = await supabase
    .from('resources')
    .select('id, name, resource_type')
    .eq('id', resourceId)
    .single()

  if (!resource) {
    throw new Error('Resource not found')
  }

  const { schedule, timelines, hits, warnings } = await computeImpact(
    supabase,
    projectId,
    resourceId,
    startDate,
    endDate,
    startTime,
    endTime
  )

  const dayById = new Map(schedule.shootDays.map((d) => [d.id, d]))
  const affectedScenes = hits.map((c) => {
    const day = dayById.get(c.dayId)!
    const scene = day.scenes.find((s) => s.scene.id === c.sceneId)!.scene
    const slot = timelines.get(c.dayId)?.slots.find((s) => s.sceneId === c.sceneId)
    return {
      sceneId: scene.id,
      sceneNumber: scene.scene_number,
      heading: scene.heading || '',
      locationName: scene.location_name || '',
      plannedSlot: `Day ${day.day_number ?? '?'}${slot ? ` · ${minutesToLabel(slot.start)}–${minutesToLabel(slot.end)}` : ''}`,
      pages: Math.max(0.125, Number(scene.page_end ?? scene.page_start ?? 0) - Number(scene.page_start ?? 0)),
    }
  })
  const dayIds = Array.from(new Set(hits.map((c) => c.dayId)))
  const totalPages = affectedScenes.reduce((sum, s) => sum + s.pages, 0)

  return {
    resourceId,
    resourceName: resource.name,
    resourceType: resource.resource_type,
    blackoutStatus: 'UNAVAILABLE',
    startDate,
    endDate,
    timeLabel: startTime && endTime ? `${minutesToLabel(clockToMinutes(startTime)!)}–${minutesToLabel(clockToMinutes(endTime)!)}` : null,
    affectedShootDays: dayIds.map((id) => ({
      dayId: id,
      dayNumber: dayById.get(id)?.day_number || 1,
      shootDate: dayById.get(id)?.shoot_date || '',
    })),
    affectedScenes: affectedScenes.map(({ pages: _pages, ...s }) => s),
    onCallWarnings: warnings.map((w) => w.description),
    totalPagesImpacted: Math.round(totalPages * 8) / 8,
    suggestedResolutions:
      affectedScenes.length > 0
        ? [
            {
              id: 'res-unassign',
              label: `Move ${affectedScenes.length} affected scene${affectedScenes.length === 1 ? '' : 's'} back to the unscheduled pool`,
              actionType: 'UNASSIGN_SCENES',
            },
          ]
        : [],
  }
}

/** Apply a suggested resolution from the impact report. */
export async function applyAvailabilityResolutionAction(
  projectId: string,
  resourceId: string,
  startDate: string,
  endDate: string,
  actionType: AvailabilityImpactReport['suggestedResolutions'][number]['actionType'],
  startTime?: string | null,
  endTime?: string | null
): Promise<{ success?: string; error?: string }> {
  if (actionType !== 'UNASSIGN_SCENES') return { error: 'This resolution is not supported yet.' }

  const supabase = await createClient()
  const { hits } = await computeImpact(supabase, projectId, resourceId, startDate, endDate, startTime, endTime)
  for (const c of hits) {
    const { error } = await supabase.from('shoot_day_scenes').delete().eq('shoot_day_id', c.dayId).eq('scene_id', c.sceneId!)
    if (error) return { error: error.message }
  }
  await syncProjectBookings(supabase, projectId)

  revalidatePath(`/projects/${projectId}/schedule`)
  revalidatePath(`/projects/${projectId}/availability`)
  return { success: `${hits.length} scene(s) moved to the unscheduled pool` }
}
