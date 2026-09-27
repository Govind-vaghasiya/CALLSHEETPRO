'use client'

import { createClient } from '@/lib/supabase/client'
import { logActivityAction } from '@/features/collaboration/actions'
import { getProjectScheduleAction } from '@/features/scheduling/actions'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import type { Database, Json } from '@/types/database'
import type {
  ScheduleVersionSnapshot,
  RevisionColor,
  ScheduleDiffResult,
  MovedSceneDiff,
  TimeShiftDiff,
} from './types'

type VersionRow = Database['public']['Tables']['schedule_versions']['Row']

/** What we keep in schedule_versions.schedule_json */
interface StoredVersion {
  versionName: string
  revisionColor: RevisionColor
  notes?: string
  snapshotData: ScheduleVersionSnapshot['snapshotData']
}

function toSnapshot(row: VersionRow): ScheduleVersionSnapshot {
  const stored = row.schedule_json as unknown as StoredVersion
  return {
    id: row.id,
    projectId: row.project_id,
    versionName: stored.versionName || row.commit_message || `Version ${row.version_number}`,
    revisionColor: stored.revisionColor || 'WHITE',
    notes: stored.notes,
    createdAt: row.created_at,
    snapshotData: stored.snapshotData,
  }
}

/**
 * Get all schedule versions for a project (shared by everyone on the project)
 */
export async function getScheduleVersionsAction(projectId: string): Promise<ScheduleVersionSnapshot[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('schedule_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false })
  if (error) {
    console.error('Failed to load schedule versions:', error)
    return []
  }
  return (data || []).map(toSnapshot)
}

async function insertVersion(
  projectId: string,
  stored: StoredVersion,
  source: 'USER' | 'SYSTEM'
): Promise<ScheduleVersionSnapshot> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Retry on the (project, version_number) unique key if two people save at once
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: latest } = await supabase
      .from('schedule_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1)
    const next = (latest?.[0]?.version_number || 0) + 1

    const { data, error } = await supabase
      .from('schedule_versions')
      .insert({
        project_id: projectId,
        version_number: next,
        commit_message: stored.versionName,
        source,
        created_by: user?.id ?? null,
        schedule_json: stored as unknown as Json,
      })
      .select('*')
      .single()
    if (data) return toSnapshot(data)
    if (error && error.code !== '23505') throw new Error(error.message)
  }
  throw new Error('Could not allocate a version number, please retry')
}

/**
 * Save a new schedule version snapshot
 */
export async function saveScheduleVersionAction(
  projectId: string,
  versionName: string,
  revisionColor: RevisionColor,
  notes?: string
): Promise<{ success: boolean; snapshot?: ScheduleVersionSnapshot; error?: string }> {
  try {
    const snapshotData = await getProjectScheduleAction(projectId)
    const snapshot = await insertVersion(
      projectId,
      { versionName: versionName.trim() || 'Schedule Snapshot', revisionColor, notes: notes?.trim() || undefined, snapshotData },
      'USER'
    )
    logActivityAction(projectId, 'REVISION_CREATED', `Saved schedule version "${snapshot.versionName}"`)
    return { success: true, snapshot }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save version snapshot' }
  }
}

/**
 * Restore a saved version as the working schedule — in place.
 * Days that still exist keep their ids (so call sheets, bookings, and call times stay attached);
 * days not in the snapshot are removed, missing ones re-created. Scenes deleted since the
 * snapshot are skipped and reported. The current schedule is auto-saved first.
 */
export async function restoreScheduleVersionAction(
  projectId: string,
  versionId: string
): Promise<{ success: boolean; skippedScenes?: number; error?: string }> {
  const supabase = createClient()
  const versions = await getScheduleVersionsAction(projectId)
  const target = versions.find((v) => v.id === versionId)
  if (!target) {
    return { success: false, error: 'Target schedule version not found' }
  }

  try {
    // 0. Safety net: snapshot what is about to be replaced
    const current = await getProjectScheduleAction(projectId)
    await insertVersion(
      projectId,
      { versionName: `Auto-backup before restoring "${target.versionName}"`, revisionColor: 'WHITE', snapshotData: current },
      'SYSTEM'
    )

    const snapshotDays = target.snapshotData.shootDays
    const snapshotIds = new Set(snapshotDays.map((d) => d.id))
    const currentIds = new Set(current.shootDays.map((d) => d.id))

    // 1. Remove days that are not in the snapshot
    const removeIds = current.shootDays.filter((d) => !snapshotIds.has(d.id)).map((d) => d.id)
    if (removeIds.length > 0) {
      const { error } = await supabase.from('shoot_days').delete().in('id', removeIds)
      if (error) throw new Error(error.message)
    }

    // 2. Park kept days on placeholder dates so date swaps don't hit the unique (project, date) key
    const kept = snapshotDays.filter((d) => currentIds.has(d.id))
    for (let i = 0; i < kept.length; i++) {
      const parked = new Date(Date.UTC(2999, 0, 1 + i)).toISOString().slice(0, 10)
      await supabase.from('shoot_days').update({ shoot_date: parked }).eq('id', kept[i].id)
    }

    // 3. Write every snapshot day back (update kept, insert missing with the same id)
    for (const d of snapshotDays) {
      const fields = {
        shoot_date: d.shoot_date,
        day_number: d.day_number,
        call_time: d.call_time,
        wrap_time: d.wrap_time,
        status: d.status,
        notes: d.notes,
        is_locked: d.is_locked,
        primary_location_id: d.primary_location_id,
        updated_at: new Date().toISOString(),
      }
      const { error } = currentIds.has(d.id)
        ? await supabase.from('shoot_days').update(fields).eq('id', d.id)
        : await supabase.from('shoot_days').insert({ id: d.id, project_id: projectId, ...fields })
      if (error) throw new Error(error.message)
    }

    // 4. Re-place scenes, skipping any deleted since the snapshot
    const dayIds = snapshotDays.map((d) => d.id)
    if (dayIds.length > 0) {
      await supabase.from('shoot_day_scenes').delete().in('shoot_day_id', dayIds)
    }
    const wantedSceneIds = snapshotDays.flatMap((d) => d.scenes.map((s) => s.scene.id))
    const { data: stillThere } = wantedSceneIds.length
      ? await supabase.from('scenes').select('id').in('id', wantedSceneIds)
      : { data: [] }
    const existingScenes = new Set((stillThere || []).map((s) => s.id))

    const assignments = snapshotDays.flatMap((d) =>
      d.scenes
        .filter((s) => existingScenes.has(s.scene.id))
        .map((s, idx) => ({
          shoot_day_id: d.id,
          scene_id: s.scene.id,
          sort_order: s.sortOrder || idx + 1,
          estimated_minutes: s.estimatedMinutes ?? null,
        }))
    )
    if (assignments.length > 0) {
      const { error } = await supabase.from('shoot_day_scenes').insert(assignments)
      if (error) throw new Error(error.message)
    }

    // 5. Bookings follow the restored placement (existing call times are kept)
    await syncProjectBookings(supabase, projectId)

    logActivityAction(projectId, 'SCHEDULE_RESTORED', `Restored schedule version "${target.versionName}"`)
    return { success: true, skippedScenes: wantedSceneIds.length - assignments.length }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to restore schedule snapshot'
    return { success: false, error: msg }
  }
}

/**
 * Pure function comparing two schedule snapshots (or Working Draft vs Snapshot)
 */
export function compareScheduleVersions(
  versionA: ScheduleVersionSnapshot,
  versionB: ScheduleVersionSnapshot
): ScheduleDiffResult {
  const daysA = versionA.snapshotData.shootDays
  const daysB = versionB.snapshotData.shootDays

  const dayNumsA = daysA.map((d) => d.day_number || 0)
  const dayNumsB = daysB.map((d) => d.day_number || 0)

  const addedDayNumbers = dayNumsB.filter((n) => !dayNumsA.includes(n))
  const removedDayNumbers = dayNumsA.filter((n) => !dayNumsB.includes(n))

  // Map scene ID -> day number in Version A
  const sceneDayMapA = new Map<string, { dayNum: number | 'Pool'; heading: string; sceneNum: string }>()
  daysA.forEach((d) => {
    d.scenes.forEach((s) => {
      sceneDayMapA.set(s.scene.id, {
        dayNum: d.day_number || 0,
        heading: s.scene.heading || 'UNTITLED',
        sceneNum: s.scene.scene_number,
      })
    })
  })
  versionA.snapshotData.unscheduledScenes.forEach((s) => {
    sceneDayMapA.set(s.id, {
      dayNum: 'Pool',
      heading: s.heading || 'UNTITLED',
      sceneNum: s.scene_number,
    })
  })

  // Map scene ID -> day number in Version B
  const movedScenes: MovedSceneDiff[] = []
  daysB.forEach((d) => {
    d.scenes.forEach((s) => {
      const prev = sceneDayMapA.get(s.scene.id)
      const currentDayNum = d.day_number || 0
      if (prev && prev.dayNum !== currentDayNum) {
        movedScenes.push({
          sceneId: s.scene.id,
          sceneNumber: s.scene.scene_number,
          heading: s.scene.heading || 'UNTITLED',
          fromDayNumber: prev.dayNum,
          toDayNumber: currentDayNum,
        })
      }
    })
  })

  versionB.snapshotData.unscheduledScenes.forEach((s) => {
    const prev = sceneDayMapA.get(s.id)
    if (prev && prev.dayNum !== 'Pool') {
      movedScenes.push({
        sceneId: s.id,
        sceneNumber: s.scene_number,
        heading: s.heading || 'UNTITLED',
        fromDayNumber: prev.dayNum,
        toDayNumber: 'Pool',
      })
    }
  })

  // Time Shift diffs
  const timeShifts: TimeShiftDiff[] = []
  daysB.forEach((dB) => {
    const dA = daysA.find((d) => d.day_number === dB.day_number)
    if (dA && dA.call_time !== dB.call_time) {
      timeShifts.push({
        dayNumber: dB.day_number || 0,
        oldCallTime: dA.call_time ? dA.call_time.slice(0, 5) : '07:00',
        newCallTime: dB.call_time ? dB.call_time.slice(0, 5) : '07:00',
      })
    }
  })

  return {
    addedDayNumbers,
    removedDayNumbers,
    movedScenes,
    timeShifts,
  }
}
