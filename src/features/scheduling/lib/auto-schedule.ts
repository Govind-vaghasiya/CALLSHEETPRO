/**
 * Smart Auto-Schedule: turns unscheduled scenes into a realistic run of shoot days.
 *
 *  1. Scenes are grouped by set (cleaned location name) and by day/night — a crew never shoots
 *     night and day work in one shooting day.
 *  2. Days are filled by workload, not scene count: up to the target pages (in eighths) and within
 *     the shooting hours, with at most N company moves. A short set is topped up with another set
 *     at the same site first, then the one sharing the most cast (fewer actor days).
 *  3. "SHOOT AFTER" rules are repaired so a scene never lands before what it depends on.
 *  4. Days get real dates: days off skipped, a turnaround day after a night block, and a day is
 *     swapped or pushed when someone it needs is unavailable all day.
 *
 * Pure function — no database access — so it can be previewed before anything is saved.
 */
import { nextDate } from './time'

export type DayPart = 'DAY' | 'NIGHT'

export interface PlannerScene {
  id: string
  number: string
  /** Script order */
  order: number
  /** Cleaned location name (the set) */
  set: string
  /** Site the set belongs to (rooms of one house share a site) */
  site: string
  /** Raw location name (what the running order compares for company moves) */
  location: string | null
  part: DayPart
  /** Length in eighths of a page */
  eighths: number
  minutes: number
  /** Cast resource ids (for keeping actors' days together) */
  cast: string[]
  /** Every resource the scene needs (cast, location, props…) for availability */
  needs: string[]
}

export interface PlannerOptions {
  startDate: string
  /** 0 = Sunday … 6 = Saturday */
  daysOff: number[]
  pagesPerDay: number
  maxMovesPerDay: number
  /** Scene minutes + company moves allowed in a shooting day */
  maxShootMinutes: number
  companyMoveMinutes: number
  /** Dates that already have a shoot day */
  usedDates: Set<string>
  /** Resource blocked for the whole of that date */
  isBlockedAllDay: (resourceId: string, date: string) => boolean
  /** scene id → scene numbers that must be shot first */
  shootAfter: Map<string, string[]>
}

export interface PlannedDay {
  date: string
  part: DayPart
  sceneIds: string[]
  eighths: number
  minutes: number
  sets: string[]
}

export interface PlanResult {
  days: PlannedDay[]
  warnings: string[]
}

interface WorkDay {
  part: DayPart
  scenes: PlannerScene[]
  eighths: number
  minutes: number
  sets: string[]
}

const SLACK_EIGHTHS = 2 // a quarter page over target is fine rather than splitting a set

export function formatEighths(eighths: number): string {
  const whole = Math.floor(eighths / 8)
  const rest = eighths % 8
  if (!rest) return `${whole}`
  return whole ? `${whole} ${rest}/8` : `${rest}/8`
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

export function planSchedule(scenes: PlannerScene[], opts: PlannerOptions): PlanResult {
  const warnings: string[] = []
  const capacity = Math.max(1, Math.round(opts.pagesPerDay * 8))

  // ---- 1. Group by day part + set, ordered so related work sits together ----------------------
  const groups = new Map<string, PlannerScene[]>()
  for (const s of [...scenes].sort((a, b) => a.order - b.order)) {
    const key = `${s.part}|${s.set}`
    groups.set(key, [...(groups.get(key) || []), s])
  }
  const siteWeight = new Map<string, number>()
  for (const s of scenes) siteWeight.set(`${s.part}|${s.site}`, (siteWeight.get(`${s.part}|${s.site}`) || 0) + s.eighths)
  const groupWeight = (g: PlannerScene[]) => g.reduce((n, s) => n + s.eighths, 0)
  const pending: PlannerScene[][] = Array.from(groups.values()).sort((a, b) => {
    if (a[0].part !== b[0].part) return a[0].part === 'DAY' ? -1 : 1 // night block after day work
    const sa = siteWeight.get(`${a[0].part}|${a[0].site}`) || 0
    const sb = siteWeight.get(`${b[0].part}|${b[0].site}`) || 0
    if (sa !== sb) return sb - sa
    if (a[0].site !== b[0].site) return a[0].site.localeCompare(b[0].site)
    return groupWeight(b) - groupWeight(a)
  })

  // ---- 2. Fill days by workload -----------------------------------------------------------------
  const dayMinutes = (d: WorkDay, s: PlannerScene) => {
    const newSet = !d.sets.includes(s.set)
    const moves = Math.max(0, d.sets.length - 1) + (newSet && d.sets.length ? 1 : 0)
    return d.scenes.reduce((m, x) => m + x.minutes, 0) + s.minutes + moves * opts.companyMoveMinutes
  }
  const fits = (d: WorkDay, s: PlannerScene) => {
    if (d.scenes.length === 0) return true
    if (s.part !== d.part) return false
    if (d.eighths + s.eighths > capacity + SLACK_EIGHTHS) return false
    if (!d.sets.includes(s.set) && d.sets.length >= opts.maxMovesPerDay + 1) return false
    return dayMinutes(d, s) <= opts.maxShootMinutes
  }
  const add = (d: WorkDay, s: PlannerScene) => {
    d.minutes = dayMinutes(d, s)
    d.scenes.push(s)
    d.eighths += s.eighths
    if (!d.sets.includes(s.set)) d.sets.push(s.set)
  }
  const takeFrom = (d: WorkDay, group: PlannerScene[]) => {
    for (let i = 0; i < group.length; ) {
      if (fits(d, group[i])) add(d, group.splice(i, 1)[0])
      else i++
    }
  }

  const work: WorkDay[] = []
  while (pending.some((g) => g.length)) {
    const first = pending.find((g) => g.length)!
    const day: WorkDay = { part: first[0].part, scenes: [], eighths: 0, minutes: 0, sets: [] }
    takeFrom(day, first)

    // Top up a short day: same site first, then shared cast, then the biggest set that fits
    while (day.eighths < capacity - 1) {
      const sites = new Set(day.scenes.map((s) => s.site))
      const cast = new Set(day.scenes.flatMap((s) => s.cast))
      let best: PlannerScene[] | null = null
      let bestScore = -1
      for (const g of pending) {
        if (!g.length || g[0].part !== day.part || !g.some((s) => fits(day, s))) continue
        const shared = new Set(g.flatMap((s) => s.cast).filter((c) => cast.has(c))).size
        const score = (day.sets.includes(g[0].set) ? 10000 : 0) + (sites.has(g[0].site) ? 1000 : 0) + shared * 50 + Math.min(40, groupWeight(g))
        if (score > bestScore) {
          bestScore = score
          best = g
        }
      }
      if (!best) break
      const before = day.scenes.length
      takeFrom(day, best)
      if (day.scenes.length === before) break
    }

    if (day.eighths > capacity + SLACK_EIGHTHS) {
      const s = day.scenes[0]
      warnings.push(`Sc ${s.number} is ${formatEighths(s.eighths)} pages — longer than one day's target, so it has a day of its own.`)
    }
    work.push(day)
  }

  // ---- 2b. Fold light days into days that still have room --------------------------------------
  // (sequential packing leaves thin days at the end of each block; fewer days = less crew cost)
  const remove = (d: WorkDay, s: PlannerScene) => {
    d.scenes = d.scenes.filter((x) => x.id !== s.id)
    d.eighths -= s.eighths
    d.sets = Array.from(new Set(d.scenes.map((x) => x.set)))
    d.minutes = d.scenes.reduce((n, x) => n + x.minutes, 0) + Math.max(0, d.sets.length - 1) * opts.companyMoveMinutes
  }
  for (const light of [...work].sort((a, b) => a.eighths - b.eighths)) {
    if (light.eighths >= capacity * 0.6 || !work.includes(light)) continue
    const others = work.filter((d) => d !== light && d.part === light.part)
    // Try placing every scene elsewhere (best fit: same set/site first, then the fullest day)
    const trial = others.map((d) => ({ ...d, scenes: [...d.scenes], sets: [...d.sets] }))
    let ok = true
    for (const s of [...light.scenes].sort((a, b) => b.eighths - a.eighths)) {
      const target = trial
        .filter((d) => fits(d, s))
        .sort(
          (a, b) =>
            Number(b.sets.includes(s.set)) - Number(a.sets.includes(s.set)) ||
            Number(b.scenes.some((x) => x.site === s.site)) - Number(a.scenes.some((x) => x.site === s.site)) ||
            b.eighths - a.eighths
        )[0]
      if (!target) {
        ok = false
        break
      }
      add(target, s)
    }
    if (!ok) continue
    others.forEach((d, i) => Object.assign(d, trial[i]))
    work.splice(work.indexOf(light), 1)
  }
  // ---- 3. "SHOOT AFTER" repairs -----------------------------------------------------------------
  const idByNumber = new Map(scenes.map((s) => [s.number.toUpperCase(), s.id]))
  const dayIndexOf = (id: string) => work.findIndex((d) => d.scenes.some((s) => s.id === id))
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const s of scenes) {
      for (const num of opts.shootAfter.get(s.id) || []) {
        const prereq = idByNumber.get(num.toUpperCase())
        if (!prereq) continue // already scheduled elsewhere, or not in this plan
        const di = dayIndexOf(s.id)
        const pi = dayIndexOf(prereq)
        if (di < 0 || pi < 0 || di >= pi) continue
        const from = work[di]
        const scene = from.scenes.find((x) => x.id === s.id)!
        remove(from, scene)
        const target = work.slice(pi).find((d) => fits(d, scene))
        if (target) add(target, scene)
        else work.splice(pi + 1, 0, { part: scene.part, scenes: [scene], eighths: scene.eighths, minutes: scene.minutes, sets: [scene.set] })
        moved = true
      }
    }
    if (!moved) break
  }
  for (let i = work.length - 1; i >= 0; i--) {
    const d = work[i]
    if (!d.scenes.length) {
      work.splice(i, 1)
      continue
    }
    // Recompute after repairs
    d.sets = Array.from(new Set(d.scenes.map((s) => s.set)))
    d.eighths = d.scenes.reduce((n, s) => n + s.eighths, 0)
    d.minutes = d.scenes.reduce((n, s) => n + s.minutes, 0) + Math.max(0, d.sets.length - 1) * opts.companyMoveMinutes
  }

  // Running order inside a day: set by set (as packed), script order within a set, prerequisites first
  for (const d of work) {
    d.scenes.sort((a, b) => d.sets.indexOf(a.set) - d.sets.indexOf(b.set) || a.order - b.order)
    for (let pass = 0; pass < d.scenes.length; pass++) {
      let swapped = false
      d.scenes.forEach((s, i) => {
        for (const num of opts.shootAfter.get(s.id) || []) {
          const j = d.scenes.findIndex((x) => x.number.toUpperCase() === num.toUpperCase())
          if (j > i) {
            d.scenes.splice(i, 1)
            d.scenes.splice(j, 0, s)
            swapped = true
          }
        }
      })
      if (!swapped) break
    }
  }

  // ---- 4. Dates ---------------------------------------------------------------------------------
  const used = new Set(opts.usedDates)
  const isWorkDate = (date: string) => !opts.daysOff.includes(weekday(date)) && !used.has(date)
  const nextWorkDate = (from: string) => {
    let d = from
    for (let i = 0; i < 3660 && !isWorkDate(d); i++) d = nextDate(d)
    return d
  }
  const blockedNeeds = (d: WorkDay, date: string) =>
    Array.from(new Set(d.scenes.flatMap((s) => s.needs))).filter((r) => opts.isBlockedAllDay(r, date))

  const dated: Array<WorkDay & { date: string }> = []
  let cursor = nextWorkDate(opts.startDate)
  let prev: (WorkDay & { date: string }) | null = null
  const queue = [...work]
  while (queue.length) {
    let date = cursor
    // Turnaround: no day call the morning after a night wrap
    if (prev && prev.part === 'NIGHT' && queue[0].part === 'DAY' && date === nextDate(prev.date)) date = nextWorkDate(nextDate(date))

    // Someone needed is out all day: shoot another planned day now instead, or push this one
    let pick = 0
    if (blockedNeeds(queue[0], date).length) {
      const alt = queue.findIndex((d, i) => i > 0 && d.part === queue[0].part && !blockedNeeds(d, date).length)
      if (alt > 0) pick = alt
    }
    const day = queue.splice(pick, 1)[0]
    let chosen = date
    if (blockedNeeds(day, chosen).length) {
      let probe = chosen
      for (let i = 0; i < 90; i++) {
        probe = nextWorkDate(nextDate(probe))
        if (!blockedNeeds(day, probe).length) break
      }
      if (!blockedNeeds(day, probe).length) chosen = probe
      else warnings.push(`No date in the next 90 days has everyone for ${day.sets.join(', ')} — check availability.`)
    }
    used.add(chosen)
    const placed = { ...day, date: chosen }
    dated.push(placed)
    if (chosen === date) {
      prev = placed
      cursor = nextWorkDate(nextDate(date))
    } else {
      cursor = nextWorkDate(cursor) // the skipped date stays free for the next day
    }
  }

  dated.sort((a, b) => a.date.localeCompare(b.date))
  return {
    days: dated.map((d) => ({
      date: d.date,
      part: d.part,
      sceneIds: d.scenes.map((s) => s.id),
      eighths: d.eighths,
      minutes: d.minutes,
      sets: d.sets,
    })),
    warnings,
  }
}
