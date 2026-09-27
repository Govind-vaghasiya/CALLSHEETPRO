/**
 * Wall-clock helpers. Schedules are planned in the production's time zone ("7:00 call" means
 * 7:00 in Asia/Kolkata), so availability windows are converted to and from that zone rather
 * than the viewer's or the server's.
 */

/** "07:30" / "07:30:00" → minutes after midnight (null when empty/invalid). */
export function clockToMinutes(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** 450 → "07:30"; values past midnight wrap (1500 → "01:00"). */
export function minutesToClock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** 450 → "7:30 AM"; a slot running past midnight shows "+1". */
export function minutesToLabel(minutes: number): string {
  const day = Math.floor(minutes / 1440)
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${suffix}${day > 0 ? ' +1' : ''}`
}

/** Offset of `timeZone` from UTC at instant `ms`, in minutes (IST → +330). */
function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - ms) / 60000)
}

/** Local date + time in `timeZone` → UTC ISO string. */
export function zonedToUtcIso(date: string, time: string, timeZone: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const minutes = clockToMinutes(time) ?? 0
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60)
  let offset = zoneOffsetMinutes(guess, timeZone)
  // Re-check once for DST boundaries
  offset = zoneOffsetMinutes(guess - offset * 60000, timeZone)
  return new Date(guess - offset * 60000).toISOString()
}

/** UTC ISO → local { date: "YYYY-MM-DD", minutes } in `timeZone`. */
export function utcToZoned(iso: string, timeZone: string): { date: string; minutes: number } {
  const ms = new Date(iso).getTime()
  const local = new Date(ms + zoneOffsetMinutes(ms, timeZone) * 60000)
  return {
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  }
}

/** Next calendar date ("2026-10-05" → "2026-10-06"). */
export function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Overlap of two [start, end) minute ranges, or null. */
export function overlap(a: [number, number], b: [number, number]): [number, number] | null {
  const start = Math.max(a[0], b[0])
  const end = Math.min(a[1], b[1])
  return end > start ? [start, end] : null
}
