import type { DoodStatusCode } from '../types'

/**
 * Day-Out-of-Days status for one day, given the (sorted) indices of days a resource works.
 * SWF = single day, SW = start, WF = finish, W = work, H = hold between work days, null = off.
 * Shared by the DOOD report and the call sheet so both always agree.
 */
export function doodStatusForDay(workedIndices: number[], dayIndex: number): DoodStatusCode {
  if (workedIndices.length === 0) return null
  const first = workedIndices[0]
  const last = workedIndices[workedIndices.length - 1]
  if (dayIndex < first || dayIndex > last) return null
  if (first === last) return 'SWF'
  if (dayIndex === first) return 'SW'
  if (dayIndex === last) return 'WF'
  return workedIndices.includes(dayIndex) ? 'W' : 'H'
}

/** "07:30:00" → "7:30 AM"; empty → null */
export function formatClockTime(value: string | null | undefined): string | null {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h)) return null
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

/** Add minutes to an "HH:MM[:SS]" clock time, wrapping at midnight. */
export function addMinutesToClock(value: string, minutes: number): string {
  const [h, m] = value.split(':').map(Number)
  const total = (((h * 60 + (m || 0) + minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
