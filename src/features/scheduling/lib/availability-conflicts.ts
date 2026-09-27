/**
 * Time-aware schedule checks: who/what each scene needs, when each scene is planned (from the
 * day's running order), and when those people, locations, and props are unavailable.
 *
 *  🔴 needed during a scene while unavailable           (e.g. Anil Kapoor 3–5 pm vs Sc 23 2:45–4:15)
 *  🟠 unavailable while on call but between scenes      (release them or use the gap)
 *  🔴 scene planned outside a location's access hours
 *  🟠 the day's scenes run past the AD's planned wrap
 */
import type { ShootDayWithScenes } from '../actions'
import type { ScheduleConflict } from './conflict-detector'
import type { ResourceAvailabilityWindow } from '@/features/availability/types'
import { BLOCKING_STATUSES, windowRangeOnDate } from '@/features/availability/lib/windows'
import { buildDayTimeline, personWindow, type DayTimeline, type TimelineSettings, DEFAULT_TIMELINE_SETTINGS } from './day-timeline'
import { minutesToLabel, nextDate, overlap, clockToMinutes } from './time'

export interface SceneNeed {
  resourceId: string
  name: string
  type: string
  /** Character played, for cast */
  character: string | null
}

export interface ScheduleConstraints {
  windows: ResourceAvailabilityWindow[]
  /** scene id → who/what it needs */
  needsByScene: Map<string, SceneNeed[]>
  /** `${dayId}:${resourceId}` → AD-set call/wrap on the booking */
  bookingTimes: Map<string, { call: string | null; wrap: string | null }>
  /** location resource id → access hours */
  locationHours: Map<string, { start: string | null; end: string | null }>
  /** scene id → scene numbers that must be shot before it (tag "SHOOT AFTER 23") */
  shootAfter: Map<string, string[]>
  /** resource id → cost of one paid day (for hold-day savings) */
  dayRates: Map<string, number>
  currency: string
  settings: TimelineSettings
}

export const EMPTY_CONSTRAINTS: ScheduleConstraints = {
  windows: [],
  needsByScene: new Map(),
  bookingTimes: new Map(),
  locationHours: new Map(),
  shootAfter: new Map(),
  dayRates: new Map(),
  currency: 'USD',
  settings: DEFAULT_TIMELINE_SETTINGS,
}

/** "SHOOT AFTER 23", "shoot after sc 23, 24A" → ["23", "24A"] */
export function parseShootAfterTag(label: string): string[] {
  const m = /^\s*shoot\s+after\s+(?:sc(?:ene)?\.?\s*)?(.+)$/i.exec(label)
  if (!m) return []
  return m[1]
    .split(/[,&]|\band\b/i)
    .map((x) => x.replace(/^\s*(?:sc(?:ene)?\.?\s*|#)/i, '').trim().toUpperCase())
    .filter(Boolean)
}

/** Continuity: a scene tagged "SHOOT AFTER 23" must be scheduled after scene 23. */
export function detectContinuityConflicts(days: ShootDayWithScenes[], shootAfter: Map<string, string[]>): ScheduleConflict[] {
  if (shootAfter.size === 0) return []
  const ordered = [...days].sort((a, b) => a.shoot_date.localeCompare(b.shoot_date))
  const position = new Map<string, { rank: number; day: ShootDayWithScenes }>()
  const idByNumber = new Map<string, string>()
  let rank = 0
  for (const d of ordered) {
    for (const s of d.scenes) {
      position.set(s.scene.id, { rank: rank++, day: d })
      idByNumber.set(s.scene.scene_number.toUpperCase(), s.scene.id)
    }
  }
  const out: ScheduleConflict[] = []
  for (const [sceneId, befores] of shootAfter) {
    const me = position.get(sceneId)
    if (!me) continue
    const myNumber = me.day.scenes.find((s) => s.scene.id === sceneId)?.scene.scene_number
    for (const num of befores) {
      const otherId = idByNumber.get(num)
      const other = otherId ? position.get(otherId) : undefined
      if (other && other.rank > me.rank) {
        out.push({
          id: `continuity-${sceneId}-${num}`,
          severity: 'CRITICAL',
          type: 'CAST',
          dayId: me.day.id,
          dayNumber: me.day.day_number ?? 0,
          sceneId,
          title: `Continuity: Sc ${myNumber} must be shot after Sc ${num}`,
          description: `Sc ${myNumber} (Day ${me.day.day_number}) is scheduled before Sc ${num} (Day ${other.day.day_number}), but it is tagged "SHOOT AFTER ${num}".`,
        })
      }
    }
  }
  return out
}

export function timelineForDay(day: ShootDayWithScenes, settings: TimelineSettings): DayTimeline {
  return buildDayTimeline(
    day.call_time,
    day.wrap_time,
    day.scenes.map((s) => ({
      sceneId: s.scene.id,
      minutes: s.estimatedMinutes || 30,
      location: s.scene.location_name,
      fixedStart: s.fixedStartTime ?? null,
    })),
    settings
  )
}

const range = (a: number, b: number) => `${minutesToLabel(a)}–${minutesToLabel(b)}`

export function detectAvailabilityConflicts(
  days: ShootDayWithScenes[],
  c: ScheduleConstraints
): { conflicts: ScheduleConflict[]; timelines: Map<string, DayTimeline> } {
  const conflicts: ScheduleConflict[] = []
  const timelines = new Map<string, DayTimeline>()

  for (const day of days) {
    const dayNum = day.day_number ?? 0
    const tl = timelineForDay(day, c.settings)
    timelines.set(day.id, tl)
    const sceneNo = new Map(day.scenes.map((s) => [s.scene.id, s.scene.scene_number]))

    // Past the planned wrap
    if (tl.plannedWrap !== null && tl.slots.length && tl.estimatedWrap > tl.plannedWrap) {
      conflicts.push({
        id: `wrap-${day.id}`,
        severity: 'WARNING',
        type: 'OVERRUN',
        dayId: day.id,
        dayNumber: dayNum,
        title: `Day ${dayNum} runs past the planned wrap`,
        description: `Scenes are estimated to finish at ${minutesToLabel(tl.estimatedWrap)}, ${
          tl.estimatedWrap - tl.plannedWrap
        } min after the planned wrap (${minutesToLabel(tl.plannedWrap)}).`,
      })
    }

    // Pinned scenes that can't start on time
    for (const slot of tl.slots) {
      if (slot.fixed && slot.lateBy && slot.lateBy > 0) {
        conflicts.push({
          id: `late-${day.id}-${slot.sceneId}`,
          severity: slot.lateBy > 30 ? 'CRITICAL' : 'WARNING',
          type: 'OVERRUN',
          dayId: day.id,
          dayNumber: dayNum,
          sceneId: slot.sceneId,
          title: `Sc ${sceneNo.get(slot.sceneId)} can't start at its fixed time`,
          description: `Fixed to start at ${minutesToLabel(slot.start - slot.lateBy)}, but earlier scenes run until ${minutesToLabel(
            slot.start
          )} (${slot.lateBy} min late). Shorten or move an earlier scene.`,
        })
      }
    }

    // Who/what is needed today, and in which scenes
    const needed = new Map<string, { need: SceneNeed; scenes: Set<string> }>()
    for (const s of day.scenes) {
      for (const need of c.needsByScene.get(s.scene.id) || []) {
        const entry = needed.get(need.resourceId) || { need, scenes: new Set<string>() }
        entry.scenes.add(s.scene.id)
        needed.set(need.resourceId, entry)
      }
    }

    for (const [resourceId, { need, scenes }] of needed) {
      const label = need.character ? `${need.name} (${need.character})` : need.name
      const mySlots = tl.slots.filter((s) => scenes.has(s.sceneId))

      // Unavailable windows on the shoot date (and the next date, for scenes past midnight)
      const blocks = c.windows
        .filter((w) => w.resource_id === resourceId && BLOCKING_STATUSES.includes(w.status))
        .flatMap((w) => {
          const today = windowRangeOnDate(w, day.shoot_date)
          const tomorrow = windowRangeOnDate(w, nextDate(day.shoot_date))
          return [
            today ? { range: today, w } : null,
            tomorrow ? { range: [tomorrow[0] + 1440, tomorrow[1] + 1440] as [number, number], w } : null,
          ].filter((b): b is { range: [number, number]; w: ResourceAvailabilityWindow } => b !== null)
        })

      const hitScenes = new Set<string>()
      for (const block of blocks) {
        const when = block.w.all_day ? 'all day' : range(block.range[0], block.range[1])
        const why = `${block.w.status === 'TRAVEL' ? 'Travelling' : 'Unavailable'} ${when}${block.w.notes ? ` (${block.w.notes})` : ''}`
        for (const slot of mySlots) {
          const hit = overlap(block.range, [slot.start, slot.end])
          if (!hit) continue
          hitScenes.add(slot.sceneId)
          conflicts.push({
            id: `unavail-${block.w.id}-${slot.sceneId}`,
            severity: 'CRITICAL',
            type: 'RESOURCE_UNAVAILABLE',
            dayId: day.id,
            dayNumber: dayNum,
            sceneId: slot.sceneId,
            title: `${label} ${block.w.status === 'TRAVEL' ? 'travelling' : 'unavailable'} during Sc ${sceneNo.get(slot.sceneId)}`,
            description: `${why}. Sc ${sceneNo.get(slot.sceneId)} is planned ${range(slot.start, slot.end)} on Day ${dayNum}.`,
          })
        }
      }

      // On call but unavailable between their scenes
      if (need.type === 'PERSON') {
        const booking = c.bookingTimes.get(`${day.id}:${resourceId}`)
        const win = personWindow(tl, scenes, {
          prepMinutes: need.character ? c.settings.castPrepMinutes : 0,
          bookingCall: booking?.call,
          bookingWrap: booking?.wrap,
        })
        if (win) {
          for (const block of blocks) {
            const hit = overlap(block.range, [win.call, win.release])
            const inScene = mySlots.some((s) => overlap(block.range, [s.start, s.end]))
            if (hit && !inScene) {
              conflicts.push({
                id: `oncall-${block.w.id}-${day.id}`,
                severity: 'WARNING',
                type: 'RESOURCE_UNAVAILABLE',
                dayId: day.id,
                dayNumber: dayNum,
                title: `${label} unavailable while on call (Day ${dayNum})`,
                description: `On call ${range(win.call, win.release)} but unavailable ${range(hit[0], hit[1])}${
                  block.w.notes ? ` (${block.w.notes})` : ''
                }. No scene of theirs is affected — release them for that time or use the gap.`,
              })
            }
          }
        }
      }

      // Location access hours
      if (need.type === 'LOCATION') {
        const hours = c.locationHours.get(resourceId)
        const open = clockToMinutes(hours?.start)
        let close = clockToMinutes(hours?.end)
        if (open !== null && close !== null) {
          if (close <= open) close += 1440
          for (const slot of mySlots) {
            if (hitScenes.has(slot.sceneId)) continue
            if (slot.start < open || slot.end > close) {
              conflicts.push({
                id: `access-${resourceId}-${slot.sceneId}`,
                severity: 'CRITICAL',
                type: 'LOCATION',
                dayId: day.id,
                dayNumber: dayNum,
                sceneId: slot.sceneId,
                title: `${need.name} closed during Sc ${sceneNo.get(slot.sceneId)}`,
                description: `Access hours are ${range(open, close)}; Sc ${sceneNo.get(slot.sceneId)} is planned ${range(
                  slot.start,
                  slot.end
                )} on Day ${dayNum}.`,
              })
            }
          }
        }
      }
    }
  }

  conflicts.push(...detectContinuityConflicts(days, c.shootAfter))
  return { conflicts, timelines }
}
