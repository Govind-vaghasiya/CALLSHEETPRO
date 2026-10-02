/**
 * Production calendar and schedule re-dating — how shoot-day dates move.
 *
 * Industry practice: the order of shoot days is the plan; dates come from a calendar (work week +
 * holidays). When a day moves (rain, late actor) the usual action is a PUSH — that day and every
 * later day slide by the same number of WORKING days, so the shooting order stays intact.
 * "Move only this day" is for fine-tuning one day.
 *
 * Days that are shot, shooting, cancelled or locked never move; pushed days flow around them.
 * Pure functions — the result is a list of date moves to preview, then apply.
 */

export interface Holiday {
  date: string
  label: string
}

export interface ProductionCalendar {
  /** 0 = Sunday … 6 = Saturday */
  workDays: number[]
  holidays: Holiday[]
}

export const DEFAULT_CALENDAR: ProductionCalendar = { workDays: [1, 2, 3, 4, 5, 6], holidays: [] }

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function holidayOn(date: string, cal: ProductionCalendar): Holiday | undefined {
  return cal.holidays.find((h) => h.date === date)
}

export function isWorkingDate(date: string, cal: ProductionCalendar): boolean {
  return cal.workDays.includes(weekdayOf(date)) && !holidayOn(date, cal)
}

/** Why a date is not a shooting day ("Sunday", "Diwali"), or null. */
export function dayOffReason(date: string, cal: ProductionCalendar): string | null {
  const h = holidayOn(date, cal)
  if (h) return h.label || 'Holiday'
  if (!cal.workDays.includes(weekdayOf(date)))
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekdayOf(date)]
  return null
}

/** The first working date on or after `date`. */
export function nextWorkingDate(date: string, cal: ProductionCalendar): string {
  if (!cal.workDays.length) return date
  let d = date
  for (let i = 0; i < 3660 && !isWorkingDate(d, cal); i++) d = addDays(d, 1)
  return d
}

/** Move `n` working days from `date` (negative = earlier). From a day off, step 1 lands on the next working day. */
export function shiftWorkingDays(date: string, n: number, cal: ProductionCalendar): string {
  if (!cal.workDays.length || n === 0) return date
  const step = n > 0 ? 1 : -1
  let d = date
  let left = Math.abs(n)
  for (let i = 0; i < 36600 && left > 0; i++) {
    d = addDays(d, step)
    if (isWorkingDate(d, cal)) left--
  }
  return d
}

/** Signed number of working days from `from` to `to` (how far a push moves things). */
export function workingDaysBetween(from: string, to: string, cal: ProductionCalendar): number {
  if (from === to) return 0
  const forward = to > from
  let count = 0
  // forward: working days in (from, to]; backward: working days in [to, from)
  let d = forward ? addDays(from, 1) : to
  const end = forward ? to : addDays(from, -1)
  for (let i = 0; i < 36600 && d <= end; i++) {
    if (isWorkingDate(d, cal)) count++
    d = addDays(d, 1)
  }
  return forward ? count : -count
}

export interface CalendarDay {
  id: string
  date: string
  dayNumber: number | null
  /** Shot, shooting, cancelled, or locked — never moved */
  fixed: boolean
}

export interface DateMove {
  dayId: string
  dayNumber: number | null
  from: string
  to: string
}

export interface DatePlan {
  moves: DateMove[]
  warnings: string[]
  error?: string
  /** Working days the push moved later days by (for the summary) */
  shift?: number
}

const label = (d: CalendarDay) => `Day ${d.dayNumber ?? '?'}`
const byDate = (a: CalendarDay, b: CalendarDay) => a.date.localeCompare(b.date)

/**
 * Re-date `moving` days in order, starting with `first` for the first one; later days keep their
 * working-day spacing (`shift`) but never land on an occupied date or before the previous day.
 */
function flow(
  moving: CalendarDay[],
  firstDate: string,
  shift: number,
  occupied: Set<string>,
  cal: ProductionCalendar
): Map<string, string> {
  const result = new Map<string, string>()
  let prev: string | null = null
  moving.forEach((d, i) => {
    let to: string = i === 0 ? firstDate : shiftWorkingDays(d.date, shift, cal)
    if (i > 0) {
      if (prev && to <= prev) to = nextWorkingDate(addDays(prev, 1), cal)
      while (occupied.has(to)) to = nextWorkingDate(addDays(to, 1), cal)
    }
    result.set(d.id, to)
    prev = to
  })
  return result
}

function toPlan(days: CalendarDay[], dates: Map<string, string>, warnings: string[], shift?: number): DatePlan {
  const moves = days
    .filter((d) => dates.has(d.id) && dates.get(d.id) !== d.date)
    .map((d) => ({ dayId: d.id, dayNumber: d.dayNumber, from: d.date, to: dates.get(d.id)! }))
  return { moves, warnings, shift }
}

function fixedPassed(days: CalendarDay[], dates: Map<string, string>): string[] {
  // A fixed day that a moved day jumped over keeps its date; the shooting order changes around it
  const out: string[] = []
  for (const f of days.filter((d) => d.fixed)) {
    const jumped = days.some((d) => dates.has(d.id) && d.date < f.date && dates.get(d.id)! > f.date)
    if (jumped) out.push(`${label(f)} is shot/locked and stays on ${f.date}; the days after it flow around it.`)
  }
  return out
}

/** Change one day's date: PUSH (it and every later day) or MOVE (only this day). */
export function planDateChange(
  days: CalendarDay[],
  dayId: string,
  newDate: string,
  mode: 'PUSH' | 'MOVE',
  cal: ProductionCalendar
): DatePlan {
  const sorted = [...days].sort(byDate)
  const target = sorted.find((d) => d.id === dayId)
  if (!target) return { moves: [], warnings: [], error: 'Day not found.' }
  if (target.fixed) return { moves: [], warnings: [], error: `${label(target)} is shot, shooting or locked — unlock it to change its date.` }
  if (!newDate) return { moves: [], warnings: [], error: 'Pick a date.' }
  if (newDate === target.date) return { moves: [], warnings: [] }

  const warnings: string[] = []
  const off = dayOffReason(newDate, cal)
  if (off) warnings.push(`${newDate} is a day off (${off}) — ${label(target)} will shoot on it anyway.`)
  const taken = sorted.find((d) => d.id !== target.id && d.date === newDate)

  if (mode === 'MOVE') {
    if (taken) return { moves: [], warnings, error: `${label(taken)} is already on that date. Pick another date, or push.` }
    const [lo, hi] = newDate > target.date ? [target.date, newDate] : [newDate, target.date]
    const passes = sorted.filter((d) => d.id !== target.id && d.date > lo && d.date < hi)
    if (passes.length) warnings.push(`${label(target)} now comes ${newDate > target.date ? 'after' : 'before'} ${passes.map(label).join(', ')}.`)
    return toPlan(days, new Map([[target.id, newDate]]), warnings)
  }

  // PUSH: the target and every later movable day keep their working-day spacing
  const index = sorted.indexOf(target)
  const previous = sorted.slice(0, index).pop()
  if (previous && newDate <= previous.date)
    return {
      moves: [],
      warnings,
      error: `${label(previous)} is on ${previous.date}. A push can't move ${label(target)} before it — use "Move only this day" to swap the order.`,
    }
  const later = sorted.slice(index + 1)
  const moving = [target, ...later.filter((d) => !d.fixed)]
  const occupied = new Set(sorted.filter((d) => !moving.includes(d)).map((d) => d.date))
  if (occupied.has(newDate)) return { moves: [], warnings, error: `${label(taken!)} is shot/locked on that date.` }

  const shift = workingDaysBetween(target.date, newDate, cal)
  const dates = flow(moving, newDate, shift, occupied, cal)
  return toPlan(days, dates, [...warnings, ...fixedPassed(days, dates)], shift)
}

/** "Insert a day off after Day N": the next day and everything after it slide one working day later. */
export function planInsertDayOff(days: CalendarDay[], afterDayId: string, cal: ProductionCalendar): DatePlan {
  const sorted = [...days].sort(byDate)
  const after = sorted.find((d) => d.id === afterDayId)
  if (!after) return { moves: [], warnings: [], error: 'Day not found.' }
  const next = sorted.slice(sorted.indexOf(after) + 1).find((d) => !d.fixed)
  if (!next) return { moves: [], warnings: [], error: `There are no later days to push after ${label(after)}.` }
  return planDateChange(days, next.id, shiftWorkingDays(next.date, 1, cal), 'PUSH', cal)
}

/**
 * Re-date the whole schedule to the calendar (after changing the work week or holidays):
 * movable days keep their order and take consecutive working dates from `startDate`.
 */
export function planReflow(days: CalendarDay[], startDate: string, cal: ProductionCalendar): DatePlan {
  const sorted = [...days].sort(byDate)
  const moving = sorted.filter((d) => !d.fixed)
  if (!moving.length) return { moves: [], warnings: [] }
  const occupied = new Set(sorted.filter((d) => d.fixed).map((d) => d.date))
  const dates = new Map<string, string>()
  let cursor = nextWorkingDate(startDate, cal)
  for (const d of moving) {
    while (occupied.has(cursor)) cursor = nextWorkingDate(addDays(cursor, 1), cal)
    dates.set(d.id, cursor)
    cursor = nextWorkingDate(addDays(cursor, 1), cal)
  }
  return toPlan(days, dates, fixedPassed(days, dates))
}

/** Apply a plan to a list of days (for previews and conflict checks). */
export function datesAfter(days: CalendarDay[], plan: DatePlan): Map<string, string> {
  const map = new Map(days.map((d) => [d.id, d.date]))
  for (const m of plan.moves) map.set(m.dayId, m.to)
  return map
}
