'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  ShootDayItem,
  ShootDaySceneItem,
  ShootDayStatus,
  Database,
} from '@/types/database'
import type { ScriptSceneItem } from '@/features/scripts/actions'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'

/** Re-derive who is booked on which day after any change to scene placement. */
async function resyncBookingsForDay(supabase: ReturnType<typeof createClient>, dayId: string) {
  const { data: day } = await supabase.from('shoot_days').select('project_id').eq('id', dayId).single()
  if (day) await syncProjectBookings(supabase, day.project_id)
}

export interface ShootDayWithScenes extends ShootDayItem {
  scenes: {
    assignmentId: string
    scene: Database['public']['Tables']['scenes']['Row']
    sortOrder: number
    estimatedMinutes?: number | null
    /** AD-pinned start ("18:10"), or null to flow from the call time */
    fixedStartTime?: string | null
  }[]
  totalEstimatedMinutes: number
}

export interface ProjectScheduleData {
  shootDays: ShootDayWithScenes[]
  unscheduledScenes: Database['public']['Tables']['scenes']['Row'][]
}

/**
 * Fetch project schedule: shoot days with assigned scenes, and unscheduled scenes pool
 */
export async function getProjectScheduleAction(projectId: string): Promise<ProjectScheduleData> {
  const supabase = createClient()

  // 1. Fetch shoot days
  const { data: days } = await supabase
    .from('shoot_days')
    .select('*')
    .eq('project_id', projectId)
    .order('day_number', { ascending: true })

  const shootDays: ShootDayWithScenes[] = []
  const assignedSceneIds = new Set<string>()

  if (days && days.length > 0) {
    const dayIds = days.map((d) => d.id)

    // Fetch shoot day scene assignments with scene details
    // (fixed_start_time needs migration 021; fall back gracefully until it has been run)
    const withFixed = await supabase
      .from('shoot_day_scenes')
      .select('id, shoot_day_id, scene_id, sort_order, estimated_minutes, fixed_start_time, scenes(*)')
      .in('shoot_day_id', dayIds)
      .order('sort_order', { ascending: true })
    const assignments = (
      withFixed.error
        ? (
            await supabase
              .from('shoot_day_scenes')
              .select('id, shoot_day_id, scene_id, sort_order, estimated_minutes, scenes(*)')
              .in('shoot_day_id', dayIds)
              .order('sort_order', { ascending: true })
          ).data
        : withFixed.data
    ) as Array<{
      id: string
      shoot_day_id: string
      sort_order: number
      estimated_minutes: number | null
      fixed_start_time?: string | null
      scenes: unknown
    }> | null

    days.forEach((day) => {
      const dayAssignments = (assignments || []).filter((a) => a.shoot_day_id === day.id)
      const dayScenes = dayAssignments
        .filter((a) => a.scenes !== null)
        .map((a) => {
          const sc = a.scenes as unknown as Database['public']['Tables']['scenes']['Row']
          assignedSceneIds.add(sc.id)
          return {
            assignmentId: a.id,
            scene: sc,
            sortOrder: a.sort_order,
            estimatedMinutes: a.estimated_minutes || sc.estimated_duration || 30,
            fixedStartTime: a.fixed_start_time ?? null,
          }
        })

      const totalMins = dayScenes.reduce((sum, item) => sum + (item.estimatedMinutes || 30), 0)

      shootDays.push({
        ...day,
        scenes: dayScenes,
        totalEstimatedMinutes: totalMins,
      })
    })
  }

  // 2. Fetch all project scenes to find unscheduled ones
  const { data: allScenes } = await supabase
    .from('scenes')
    .select('*')
    .eq('project_id', projectId)
    .order('scene_order', { ascending: true })

  const unscheduledScenes = (allScenes || []).filter((s) => !assignedSceneIds.has(s.id))

  return {
    shootDays,
    unscheduledScenes,
  }
}

/**
 * Create a new shoot day
 */
export async function createShootDayAction(
  projectId: string,
  shootDate: string,
  dayNumber?: number,
  notes?: string
): Promise<{ success: boolean; shootDay?: ShootDayItem; error?: string }> {
  const supabase = createClient()

  // Calculate next day number if not provided
  let calculatedDayNum = dayNumber
  if (!calculatedDayNum) {
    const { data: existing } = await supabase
      .from('shoot_days')
      .select('day_number')
      .eq('project_id', projectId)
      .order('day_number', { ascending: false })
      .limit(1)

    const max = existing && existing.length > 0 ? existing[0].day_number || 0 : 0
    calculatedDayNum = max + 1
  }

  const { data, error } = await supabase
    .from('shoot_days')
    .insert({
      project_id: projectId,
      shoot_date: shootDate,
      day_number: calculatedDayNum,
      call_time: '07:00:00',
      status: 'DRAFT',
      notes: notes || null,
      is_locked: false,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create shoot day' }
  }

  return { success: true, shootDay: data }
}

/**
 * Update shoot day metadata (date, call_time, notes, status, locked)
 */
export async function updateShootDayAction(
  dayId: string,
  updates: {
    shootDate?: string
    dayNumber?: number
    callTime?: string
    wrapTime?: string
    status?: ShootDayStatus
    notes?: string
    isLocked?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const payload: Partial<Database['public']['Tables']['shoot_days']['Update']> = {}
  if (updates.shootDate !== undefined) payload.shoot_date = updates.shootDate
  if (updates.dayNumber !== undefined) payload.day_number = updates.dayNumber
  if (updates.callTime !== undefined) payload.call_time = updates.callTime
  if (updates.wrapTime !== undefined) payload.wrap_time = updates.wrapTime || null
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.notes !== undefined) payload.notes = updates.notes
  if (updates.isLocked !== undefined) payload.is_locked = updates.isLocked
  payload.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('shoot_days')
    .update(payload)
    .eq('id', dayId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Delete a shoot day (scenes return to unscheduled pool automatically)
 */
export async function deleteShootDayAction(dayId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Delete day (shoot_day_scenes cascade deleted)
  const { error } = await supabase
    .from('shoot_days')
    .delete()
    .eq('id', dayId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Assign a scene to a shoot day
 */
export async function assignSceneToDayAction(
  dayId: string,
  sceneId: string,
  sortOrder = 0
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Keep the AD's adjusted minutes when a scene moves between days
  const { data: previous } = await supabase
    .from('shoot_day_scenes')
    .select('estimated_minutes')
    .eq('scene_id', sceneId)
    .maybeSingle()

  // First remove scene from any previous day assignment
  await supabase.from('shoot_day_scenes').delete().eq('scene_id', sceneId)

  // Insert assignment
  const { error } = await supabase.from('shoot_day_scenes').insert({
    shoot_day_id: dayId,
    scene_id: sceneId,
    sort_order: sortOrder,
    estimated_minutes: previous?.estimated_minutes ?? null,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await resyncBookingsForDay(supabase, dayId)
  return { success: true }
}

/**
 * Remove a scene from a shoot day (return to unscheduled pool)
 */
export async function removeSceneFromDayAction(
  dayId: string,
  sceneId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { error } = await supabase
    .from('shoot_day_scenes')
    .delete()
    .eq('shoot_day_id', dayId)
    .eq('scene_id', sceneId)

  if (error) {
    return { success: false, error: error.message }
  }

  await resyncBookingsForDay(supabase, dayId)
  return { success: true }
}

/**
 * Change a scene's estimated shooting minutes on a day (drives the day's running order)
 */
export async function updateSceneMinutesAction(
  dayId: string,
  sceneId: string,
  minutes: number
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) {
    return { success: false, error: 'Minutes must be between 1 and 1440.' }
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('shoot_day_scenes')
    .update({ estimated_minutes: Math.round(minutes), updated_at: new Date().toISOString() })
    .eq('shoot_day_id', dayId)
    .eq('scene_id', sceneId)
  return error ? { success: false, error: error.message } : { success: true }
}

/**
 * Pin a scene to an exact start time on its day (null unpins it)
 */
export async function setSceneFixedStartAction(
  dayId: string,
  sceneId: string,
  time: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await supabase
    .from('shoot_day_scenes')
    .update({ fixed_start_time: time || null, updated_at: new Date().toISOString() })
    .eq('shoot_day_id', dayId)
    .eq('scene_id', sceneId)
  if (error) {
    return {
      success: false,
      error: /fixed_start_time/.test(error.message)
        ? 'Fixed start times need a one-time database update: run supabase/migrations/021_scene_fixed_start.sql in the Supabase SQL Editor.'
        : error.message,
    }
  }
  return { success: true }
}

/**
 * Reorder assigned scenes within a shoot day
 */
export async function reorderDayScenesAction(
  dayId: string,
  orderedSceneIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const updates = orderedSceneIds.map((sceneId, idx) =>
    supabase
      .from('shoot_day_scenes')
      .update({ sort_order: idx + 1, updated_at: new Date().toISOString() })
      .eq('shoot_day_id', dayId)
      .eq('scene_id', sceneId)
  )

  await Promise.all(updates)
  return { success: true }
}

/**
 * Auto-Group unscheduled scenes into shoot days based on location and INT/EXT
 */
export async function autoGroupScheduleAction(
  projectId: string
): Promise<{ success: boolean; createdDays: number; error?: string }> {
  const supabase = createClient()

  const scheduleData = await getProjectScheduleAction(projectId)
  const unscheduled = scheduleData.unscheduledScenes

  if (unscheduled.length === 0) {
    return { success: true, createdDays: 0 }
  }

  // Group unscheduled scenes by location_name
  const groupedByLocation: Record<string, typeof unscheduled> = {}
  unscheduled.forEach((s) => {
    const loc = (s.location_name || 'UNSPECIFIED LOCATION').trim().toUpperCase()
    if (!groupedByLocation[loc]) groupedByLocation[loc] = []
    groupedByLocation[loc].push(s)
  })

  const maxDayNumber = scheduleData.shootDays.reduce((m, d) => Math.max(m, d.day_number || 0), 0)
  let dayCounter = maxDayNumber + 1
  let createdDaysCount = 0

  // New days start the day after the last scheduled day (or the project start date) and never
  // reuse a date that already has a shoot day.
  const { data: project } = await supabase.from('projects').select('start_date').eq('id', projectId).single()
  const usedDates = new Set(scheduleData.shootDays.map((d) => d.shoot_date))
  const lastDate = scheduleData.shootDays.map((d) => d.shoot_date).sort().pop()
  const cursor = new Date(`${lastDate || project?.start_date || new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  if (lastDate) cursor.setUTCDate(cursor.getUTCDate() + 1)
  const nextFreeDate = () => {
    while (usedDates.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() + 1)
    const date = cursor.toISOString().slice(0, 10)
    usedDates.add(date)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    return date
  }

  for (const [location, locationScenes] of Object.entries(groupedByLocation)) {
    // Group up to 5-6 scenes per day
    for (let i = 0; i < locationScenes.length; i += 5) {
      const batch = locationScenes.slice(i, i + 5)
      const shootDateStr = nextFreeDate()

      const { data: day, error: dayErr } = await supabase
        .from('shoot_days')
        .insert({
          project_id: projectId,
          shoot_date: shootDateStr,
          day_number: dayCounter,
          call_time: '07:00:00',
          status: 'PLANNED',
          notes: `Auto-grouped for location ${location}`,
        })
        .select('id')
        .single()

      if (dayErr || !day) continue

      createdDaysCount++
      dayCounter++

      const dayAssignments = batch.map((sc, idx) => ({
        shoot_day_id: day.id,
        scene_id: sc.id,
        sort_order: idx + 1,
        estimated_minutes: sc.estimated_duration || 30,
      }))

      await supabase.from('shoot_day_scenes').insert(dayAssignments)
    }
  }

  await syncProjectBookings(supabase, projectId)
  return { success: true, createdDays: createdDaysCount }
}
