import type { SupabaseClient } from '@supabase/supabase-js'
import type { AvailabilityStatus, Database, ResourceType } from '@/types/database'
import type { ResourceAvailabilityWindow } from '../types'
import { minutesToClock, nextDate, utcToZoned, zonedToUtcIso } from '@/features/scheduling/lib/time'

type Client = SupabaseClient<Database>

/*
 * Storage in resource_availability (timestamptz start_at/end_at, end exclusive):
 *  - All-day windows: [start_date 00:00Z, end_date + 1 day 00:00Z)   reason = null / 'ALL_DAY'
 *  - Specific hours:   exact instants of the local times in the production's time zone,
 *                      reason = 'HOURS'
 */
export const HOURS_MARKER = 'HOURS'

export const toStartAt = (date: string) => `${date}T00:00:00Z`
export const toEndAt = (date: string) => `${nextDate(date)}T00:00:00.000Z`
const fromStartAt = (ts: string) => ts.slice(0, 10)
const fromEndAt = (ts: string) => {
  const d = new Date(ts)
  d.setUTCMilliseconds(d.getUTCMilliseconds() - 1)
  return d.toISOString().slice(0, 10)
}

/** Build the stored interval for a window. */
export function windowToStorage(
  w: { start_date: string; end_date: string; all_day: boolean; start_time?: string | null; end_time?: string | null },
  timeZone: string
) {
  if (w.all_day) return { start_at: toStartAt(w.start_date), end_at: toEndAt(w.end_date), reason: null }
  return {
    start_at: zonedToUtcIso(w.start_date, w.start_time || '00:00', timeZone),
    end_at: zonedToUtcIso(w.end_date, w.end_time || '23:59', timeZone),
    reason: HOURS_MARKER,
  }
}

export async function getProjectTimeZone(sb: Client, projectId: string) {
  const { data } = await sb.from('projects').select('timezone').eq('id', projectId).single()
  return data?.timezone || 'UTC'
}

/** Load every availability window for a project, in the production's local dates and times. */
export async function loadAvailabilityWindows(sb: Client, projectId: string): Promise<ResourceAvailabilityWindow[]> {
  const [{ data }, timeZone] = await Promise.all([
    sb
      .from('resource_availability')
      .select('*, resources(name, resource_type)')
      .eq('project_id', projectId)
      .order('start_at', { ascending: true }),
    getProjectTimeZone(sb, projectId),
  ])

  return (data || []).map((row) => {
    const res = row.resources as unknown as { name: string; resource_type: ResourceType } | null
    const base = {
      id: row.id,
      resource_id: row.resource_id,
      resource_name: res?.name || '',
      resource_type: res?.resource_type || ('OTHER' as ResourceType),
      status: row.status,
      notes: row.notes,
      created_at: row.created_at,
    }
    if (row.reason === HOURS_MARKER) {
      const start = utcToZoned(row.start_at, timeZone)
      const end = utcToZoned(row.end_at, timeZone)
      return {
        ...base,
        all_day: false,
        start_date: start.date,
        end_date: end.date,
        start_time: minutesToClock(start.minutes),
        end_time: minutesToClock(end.minutes),
      }
    }
    return {
      ...base,
      all_day: true,
      start_date: fromStartAt(row.start_at),
      end_date: fromEndAt(row.end_at),
      start_time: null,
      end_time: null,
    }
  })
}

/** Statuses that mean the resource cannot be used during the window. */
export const BLOCKING_STATUSES: AvailabilityStatus[] = ['UNAVAILABLE', 'TRAVEL', 'PARTIAL']

/**
 * The part of a window that falls on `date`, as a [start, end) minute range (0–1440), or null.
 */
export function windowRangeOnDate(w: ResourceAvailabilityWindow, date: string): [number, number] | null {
  if (date < w.start_date || date > w.end_date) return null
  if (w.all_day) return [0, 1440]
  const toMin = (t: string | null, fallback: number) => {
    if (!t) return fallback
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const start = date === w.start_date ? toMin(w.start_time, 0) : 0
  const end = date === w.end_date ? toMin(w.end_time, 1440) : 1440
  return end > start ? [start, end] : null
}

/** Status of one resource on one date (whole-day view), from already-loaded windows. */
export function availabilityOnDate(windows: ResourceAvailabilityWindow[], resourceId: string, date: string) {
  const window = windows.find((w) => w.resource_id === resourceId && windowRangeOnDate(w, date))
  if (!window) return { isAvailable: true, status: 'AVAILABLE' as AvailabilityStatus }
  return {
    isAvailable: !window.all_day || !BLOCKING_STATUSES.includes(window.status),
    status: window.status,
    notes: window.notes || undefined,
    partial: !window.all_day,
  }
}
