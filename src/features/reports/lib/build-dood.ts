import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { DoodReportData, DoodResourceRow, DoodStatusCode } from '../types'
import { doodStatusForDay } from './dood-status'
import { availabilityOnDate, loadAvailabilityWindows } from '@/features/availability/lib/windows'

/**
 * Day-Out-of-Days from real links: a resource works a day when one of that day's scenes is
 * tagged with it in the breakdown (materialised as resource_bookings). Travel comes from the
 * availability calendar. Cast numbering matches the call sheet.
 */
export async function buildDoodReport(sb: SupabaseClient<Database>, projectId: string): Promise<DoodReportData> {
  const { data: project } = await sb.from('projects').select('id, name').eq('id', projectId).single()
  if (!project) {
    throw new Error('Project not found')
  }

  const [{ data: shootDays }, { data: resources }, { data: bookings }, windows] =
    await Promise.all([
      sb
        .from('shoot_days')
        .select('id, day_number, shoot_date')
        .eq('project_id', projectId)
        .order('day_number', { ascending: true }),
      sb
        .from('resources')
        .select('id, name, display_name, resource_type, notes')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      sb.from('resource_bookings').select('shoot_day_id, resource_id').eq('project_id', projectId),
      loadAvailabilityWindows(sb, projectId),
    ])

  const days = (shootDays || []).map((sd, idx) => ({
    id: sd.id,
    day_number: sd.day_number || idx + 1,
    shoot_date: sd.shoot_date,
  }))

  // Cast numbers and character names come from the cast list (characters → actor)
  const { data: characters } = await sb
    .from('characters')
    .select('name, cast_number, actor_resource_id')
    .eq('project_id', projectId)
    .not('actor_resource_id', 'is', null)
  const castNumber = new Map<string, number>()
  const playing = new Map<string, string[]>()
  for (const c of characters || []) {
    const id = c.actor_resource_id!
    if (c.cast_number != null) castNumber.set(id, Math.min(castNumber.get(id) ?? Infinity, c.cast_number))
    playing.set(id, [...(playing.get(id) || []), c.name])
  }

  const castRows: DoodResourceRow[] = []
  const equipmentRows: DoodResourceRow[] = []
  const locationRows: DoodResourceRow[] = []

  for (const res of resources || []) {
    const workedIndices = days
      .map((d, i) => ((bookings || []).some((b) => b.shoot_day_id === d.id && b.resource_id === res.id) ? i : -1))
      .filter((i) => i >= 0)

    const dailyStatuses: Record<string, DoodStatusCode> = {}
    let workCount = 0
    let holdCount = 0
    let travelCount = 0

    days.forEach((d, i) => {
      if (availabilityOnDate(windows, res.id, d.shoot_date).status === 'TRAVEL') {
        dailyStatuses[d.id] = 'T'
        travelCount++
        return
      }
      const status = doodStatusForDay(workedIndices, i)
      dailyStatuses[d.id] = status
      if (status === 'H') holdCount++
      else if (status) workCount++
    })

    const row: DoodResourceRow = {
      resource_id: res.id,
      resource_name: res.name,
      character_name: playing.get(res.id)?.join(', ') ?? null,
      id_number: castNumber.get(res.id),
      resource_type: res.resource_type,
      daily_statuses: dailyStatuses,
      total_work_days: workCount,
      total_hold_days: holdCount,
      total_travel_days: travelCount,
    }

    if (res.resource_type === 'PERSON') castRows.push(row)
    else if (res.resource_type === 'LOCATION') locationRows.push(row)
    else equipmentRows.push(row) // equipment, props, vehicles, animals, other
  }

  // Numbered cast first (in cast-number order), then crew alphabetically
  castRows.sort((a, b) => (a.id_number ?? Infinity) - (b.id_number ?? Infinity))

  return {
    project_id: projectId,
    project_name: project.name,
    shoot_days: days,
    cast_rows: castRows,
    equipment_rows: equipmentRows,
    location_rows: locationRows,
  }
}
