'use client'

import { createClient } from '@/lib/supabase/client'
import type { Json } from '@/types/database'
import type { ProjectScheduleData, ShootDayWithScenes } from '../actions'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import { saveScheduleVersionAction } from '@/features/versioning/actions'
import { logActivityAction } from '@/features/collaboration/actions'
import { addDays, DEFAULT_CALENDAR, type CalendarDay, type DatePlan, type Holiday, type ProductionCalendar } from './production-calendar'

type Client = ReturnType<typeof createClient>

/** Day 1, 2, 3 … in date order (callers skip this once shooting has started). */
export async function renumberDaysByDate(sb: Client, projectId: string) {
  const { data: all } = await sb.from('shoot_days').select('id, day_number').eq('project_id', projectId).order('shoot_date')
  const changes = (all || []).map((d, i) => ({ id: d.id, n: i + 1, old: d.day_number })).filter((d) => d.n !== d.old)
  for (let i = 0; i < changes.length; i += 20) {
    await Promise.all(changes.slice(i, i + 20).map((c) => sb.from('shoot_days').update({ day_number: c.n }).eq('id', c.id)))
  }
}

/** Days that are shot, shooting, cancelled or locked never move. */
export const isFixedDay = (d: ShootDayWithScenes) =>
  d.is_locked || d.status === 'COMPLETED' || d.status === 'IN_PROGRESS' || d.status === 'CANCELLED'

export const toCalendarDays = (schedule: ProjectScheduleData): CalendarDay[] =>
  schedule.shootDays.map((d) => ({ id: d.id, date: d.shoot_date, dayNumber: d.day_number, fixed: isFixedDay(d) }))

/** Shooting has started — day numbers stay as they are. */
export const numbersFixed = (schedule: ProjectScheduleData) =>
  schedule.shootDays.some((d) => d.status === 'IN_PROGRESS' || d.status === 'COMPLETED')

/**
 * The project's calendar. `stored: false` means migration 022 hasn't been run yet — the default
 * six-day week is used and the settings can't be saved.
 */
export async function loadProductionCalendar(sb: Client, projectId: string): Promise<ProductionCalendar & { stored: boolean }> {
  const { data, error } = await sb.from('project_settings').select('work_days, holidays').eq('project_id', projectId).maybeSingle()
  if (error || !data) return { ...DEFAULT_CALENDAR, stored: !error }
  const row = data as unknown as { work_days: number[] | null; holidays: Holiday[] | null }
  return {
    workDays: Array.isArray(row.work_days) ? row.work_days.map(Number) : DEFAULT_CALENDAR.workDays,
    holidays: Array.isArray(row.holidays) ? row.holidays.filter((h) => h && h.date) : [],
    stored: true,
  }
}

export async function saveProductionCalendar(projectId: string, cal: ProductionCalendar): Promise<{ success: boolean; error?: string }> {
  const sb = createClient()
  const holidays = [...cal.holidays].sort((a, b) => a.date.localeCompare(b.date))
  const { error } = await sb
    .from('project_settings')
    .update({ work_days: [...cal.workDays].sort(), holidays: holidays as unknown as Json, updated_at: new Date().toISOString() } as never)
    .eq('project_id', projectId)
  if (error) {
    if (/work_days|holidays/.test(error.message))
      return { success: false, error: 'The production calendar needs database migration 022. Run it in Supabase, then save again.' }
    return { success: false, error: error.message }
  }
  return { success: true }
}

/** Shoot day id → its published call sheet's date (to flag sheets the crew got with an old date). */
export async function loadPublishedCallSheetDates(sb: Client, projectId: string): Promise<Map<string, string | null>> {
  const { data } = await sb
    .from('call_sheets')
    .select('shoot_day_id, shoot_date, status')
    .eq('project_id', projectId)
    .in('status', ['PUBLISHED', 'REVISED'])
  return new Map((data || []).map((c) => [c.shoot_day_id, c.shoot_date]))
}

/**
 * Apply re-dated days: backup version → move days (via temporary dates, since two days can't share
 * a date even for a moment) → day numbers by date (until shooting starts) → bookings re-derived.
 */
export async function applyDatePlan(
  projectId: string,
  plan: DatePlan,
  title: string,
  keepNumbers: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!plan.moves.length) return { success: true }
  const sb = createClient()
  const backup = await saveScheduleVersionAction(projectId, `Before: ${title}`.slice(0, 120), 'WHITE', 'Automatic backup before changing shoot dates')
  if (!backup.success) return { success: false, error: backup.error || 'Could not save a backup version' }

  const update = async (pairs: Array<{ id: string; date: string }>) => {
    for (let i = 0; i < pairs.length; i += 20) {
      const results = await Promise.all(
        pairs
          .slice(i, i + 20)
          .map((p) => sb.from('shoot_days').update({ shoot_date: p.date, updated_at: new Date().toISOString() }).eq('id', p.id))
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) return failed.error.message
    }
    return null
  }

  // Park moving days on unique far-future dates, then set the real ones
  const parkErr = await update(plan.moves.map((m, i) => ({ id: m.dayId, date: addDays('2999-01-01', i) })))
  if (parkErr) return { success: false, error: `Could not move days: ${parkErr}` }
  const err = await update(plan.moves.map((m) => ({ id: m.dayId, date: m.to })))
  if (err) return { success: false, error: `Could not move days: ${err}. Restore "Before: ${title}" from the version menu.` }

  if (!keepNumbers) await renumberDaysByDate(sb, projectId)
  await syncProjectBookings(sb, projectId)
  logActivityAction(projectId, 'SCHEDULE_MOVE', title, `${plan.moves.length} day${plan.moves.length > 1 ? 's' : ''} re-dated`)
  return { success: true }
}
