/**
 * Running order for a shoot day: estimated start/end for every scene, derived from the AD's
 * call time (fixed), scene order, and each scene's estimated minutes.
 *
 *   call → first setup → scene, scene, [company move], scene … [meal at the 6-hour mark] … wrap
 *
 * Times are minutes after midnight on the shoot date (may exceed 1440 for late nights).
 * Pure function — used by the stripboard, conflict checks, impact analysis, and call sheets.
 */
import { clockToMinutes } from './time'

export interface TimelineSettings {
  /** Crew call → first shot (lighting, blocking) */
  firstSetupMinutes: number
  /** Meal must start by this many minutes after call */
  mealByMinutes: number
  mealMinutes: number
  /** Added when consecutive scenes are at different locations */
  companyMoveMinutes: number
  /** Cast arrive this long before their first scene (hair, makeup, wardrobe) */
  castPrepMinutes: number
}

export const DEFAULT_TIMELINE_SETTINGS: TimelineSettings = {
  firstSetupMinutes: 30,
  mealByMinutes: 6 * 60,
  mealMinutes: 60,
  companyMoveMinutes: 30,
  castPrepMinutes: 60,
}

export interface TimelineScene {
  sceneId: string
  minutes: number
  location: string | null
  /** AD-pinned start ("18:10"); the scene never starts earlier */
  fixedStart?: string | null
}

export interface SceneSlot {
  sceneId: string
  start: number
  end: number
  /** Pinned by the AD */
  fixed?: boolean
  /** Minutes the scene starts after its pinned time (earlier scenes overran) */
  lateBy?: number
}

export interface DayTimeline {
  call: number
  slots: SceneSlot[]
  meal: { start: number; end: number } | null
  moves: Array<{ start: number; end: number; to: string }>
  /** Idle time waiting for a pinned scene — free time the crew could use */
  gaps: Array<{ start: number; end: number; beforeSceneId: string }>
  /** When the last scene ends (call if the day is empty) */
  estimatedWrap: number
  /** The AD's planned wrap, if set */
  plannedWrap: number | null
}

export function buildDayTimeline(
  callTime: string | null,
  wrapTime: string | null,
  scenes: TimelineScene[],
  settings: TimelineSettings = DEFAULT_TIMELINE_SETTINGS
): DayTimeline {
  const call = clockToMinutes(callTime) ?? 7 * 60
  let plannedWrap = clockToMinutes(wrapTime)
  if (plannedWrap !== null && plannedWrap <= call) plannedWrap += 1440 // night shoot wrapping after midnight

  const slots: SceneSlot[] = []
  const moves: DayTimeline['moves'] = []
  const gaps: DayTimeline['gaps'] = []
  let meal: DayTimeline['meal'] = null
  let cursor = call + settings.firstSetupMinutes
  let lastLocation: string | null = null
  const mealDeadline = call + settings.mealByMinutes

  const norm = (l: string | null) => (l || '').trim().toUpperCase()

  scenes.forEach((scene, i) => {
    const minutes = Math.max(1, scene.minutes || 30)

    if (i > 0 && norm(scene.location) && norm(scene.location) !== norm(lastLocation)) {
      moves.push({ start: cursor, end: cursor + settings.companyMoveMinutes, to: scene.location || '' })
      cursor += settings.companyMoveMinutes
    }

    // Break for the meal before a scene that would run past the 6-hour mark
    if (!meal && cursor + minutes > mealDeadline && cursor > call + settings.firstSetupMinutes) {
      const start = Math.min(cursor, mealDeadline)
      meal = { start, end: start + settings.mealMinutes }
      cursor = Math.max(cursor, meal.end)
    }

    let fixed = clockToMinutes(scene.fixedStart)
    if (fixed !== null) {
      if (fixed < call) fixed += 1440 // pinned after midnight on a night shoot
      if (cursor < fixed) {
        // Lunch happens during a long wait that crosses the 6-hour mark
        if (!meal && fixed > mealDeadline) {
          const start = Math.max(cursor, Math.min(mealDeadline, fixed) - settings.mealMinutes)
          meal = { start, end: start + settings.mealMinutes }
        }
        // Free time either side of lunch
        const m = meal && meal.end > cursor && meal.start < fixed ? meal : null
        const pieces: Array<[number, number]> = m ? [[cursor, m.start], [m.end, fixed]] : [[cursor, fixed]]
        for (const [a, b] of pieces) if (b - a >= 5) gaps.push({ start: a, end: b, beforeSceneId: scene.sceneId })
        cursor = fixed
      }
    }
    slots.push({
      sceneId: scene.sceneId,
      start: cursor,
      end: cursor + minutes,
      ...(fixed !== null ? { fixed: true, lateBy: cursor > fixed ? cursor - fixed : 0 } : {}),
    })
    cursor += minutes
    if (norm(scene.location)) lastLocation = scene.location
  })

  return {
    call,
    slots,
    meal,
    moves,
    gaps,
    estimatedWrap: slots.length ? slots[slots.length - 1].end : call,
    plannedWrap,
  }
}

/**
 * When a person is needed: from (first scene − prep) to the end of their last scene.
 * An explicit booking call/wrap from the AD always wins.
 */
export function personWindow(
  timeline: DayTimeline,
  sceneIds: Set<string>,
  opts: { prepMinutes: number; bookingCall?: string | null; bookingWrap?: string | null }
): { call: number; release: number } | null {
  const mine = timeline.slots.filter((s) => sceneIds.has(s.sceneId))
  if (mine.length === 0) return null
  const derivedCall = Math.max(timeline.call, mine[0].start - opts.prepMinutes)
  const derivedRelease = mine[mine.length - 1].end
  let call = clockToMinutes(opts.bookingCall) ?? derivedCall
  let release = clockToMinutes(opts.bookingWrap) ?? derivedRelease
  if (call < timeline.call - 12 * 60) call += 1440
  if (release < call) release += 1440
  return { call, release }
}
