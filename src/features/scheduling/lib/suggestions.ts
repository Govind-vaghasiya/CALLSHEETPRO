/**
 * Schedule suggestions — a small what-if simulator.
 *
 * Each candidate change is applied to a copy of the schedule and the full rule set is re-run
 * (availability by the hour, location access, fixed starts, continuity, turnaround, day length).
 * A candidate is offered only if it improves things without creating a new critical issue, and
 * is ranked by: problems fixed → paid days saved (holds, from Cast & Crew rates) → company moves →
 * finishing on time → staying close to the original plan.
 *
 * Pure: the same schedule always gives the same suggestions, so Apply re-uses the exact plan shown.
 */
import type { ShootDayWithScenes, ProjectScheduleData } from '../actions'
import { detectScheduleConflicts, type ScheduleConflict } from './conflict-detector'
import { detectAvailabilityConflicts, type ScheduleConstraints } from './availability-conflicts'
import type { DayTimeline } from './day-timeline'
import { minutesToLabel } from './time'
import { doodStatusForDay } from '@/features/reports/lib/dood-status'

type SceneRow = ShootDayWithScenes['scenes'][number]['scene']
type Placement = ShootDayWithScenes['scenes'][number]

export type PlanOp =
  | { type: 'MOVE'; sceneId: string; toDayId: string | null } // null = back to the unscheduled pool
  | { type: 'ORDER'; dayId: string; sceneIds: string[] }

export type SuggestionKind = 'REORDER' | 'MOVE_DAY' | 'FILL' | 'TO_POOL'

export interface Suggestion {
  id: string
  kind: SuggestionKind
  title: string
  details: string[]
  impact: {
    fixes: number
    newIssues: string[]
    paidDaysSaved: number
    costSaved: number
    companyMovesDelta: number
    minutesFilled?: number
  }
  ops: PlanOp[]
  score: number
}

interface Evaluation {
  critical: Map<string, ScheduleConflict>
  warnings: Map<string, ScheduleConflict>
  timelines: Map<string, DayTimeline>
}

// ---------------------------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------------------------

function evaluate(days: ShootDayWithScenes[], c: ScheduleConstraints): Evaluation {
  const timed = detectAvailabilityConflicts(days, c)
  const all = [...timed.conflicts, ...detectScheduleConflicts(days)]
  return {
    critical: new Map(all.filter((x) => x.severity === 'CRITICAL').map((x) => [x.id, x])),
    warnings: new Map(all.filter((x) => x.severity === 'WARNING').map((x) => [x.id, x])),
    timelines: timed.timelines,
  }
}

function recount(day: ShootDayWithScenes): ShootDayWithScenes {
  return { ...day, totalEstimatedMinutes: day.scenes.reduce((m, s) => m + (s.estimatedMinutes || 30), 0) }
}

/** Apply ops to a copy of the schedule. */
export function simulate(data: ProjectScheduleData, ops: PlanOp[]): ProjectScheduleData {
  let days = data.shootDays.map((d) => ({ ...d, scenes: [...d.scenes] }))
  let pool = [...data.unscheduledScenes]
  const placementOf = (sceneId: string): Placement | null => {
    for (const d of days) {
      const p = d.scenes.find((s) => s.scene.id === sceneId)
      if (p) return p
    }
    const sc = pool.find((s) => s.id === sceneId)
    return sc
      ? { assignmentId: `sim-${sc.id}`, scene: sc, sortOrder: 0, estimatedMinutes: sc.estimated_duration || 30, fixedStartTime: null }
      : null
  }

  for (const op of ops) {
    if (op.type === 'MOVE') {
      const placement = placementOf(op.sceneId)
      if (!placement) continue
      days = days.map((d) => ({ ...d, scenes: d.scenes.filter((s) => s.scene.id !== op.sceneId) }))
      pool = pool.filter((s) => s.id !== op.sceneId)
      if (op.toDayId === null) pool.push(placement.scene)
      else {
        const moved = { ...placement, fixedStartTime: null } // a pin belongs to its original day
        days = days.map((d) => (d.id === op.toDayId ? { ...d, scenes: [...d.scenes, moved] } : d))
      }
    } else {
      days = days.map((d) => {
        if (d.id !== op.dayId) return d
        const byId = new Map(d.scenes.map((s) => [s.scene.id, s]))
        const ordered = op.sceneIds.map((id) => byId.get(id)).filter((p): p is Placement => !!p)
        const rest = d.scenes.filter((s) => !op.sceneIds.includes(s.scene.id))
        return { ...d, scenes: [...ordered, ...rest] }
      })
    }
  }
  return { shootDays: days.map(recount), unscheduledScenes: pool }
}

/** Paid days (work + hold) per resource, from what each scene needs. */
function paidDays(days: ShootDayWithScenes[], c: ScheduleConstraints, resourceIds: Set<string>) {
  const ordered = [...days].sort((a, b) => a.shoot_date.localeCompare(b.shoot_date))
  const worked = new Map<string, number[]>()
  ordered.forEach((d, i) => {
    for (const s of d.scenes) {
      for (const need of c.needsByScene.get(s.scene.id) || []) {
        if (!resourceIds.has(need.resourceId)) continue
        const list = worked.get(need.resourceId) || []
        if (list[list.length - 1] !== i) list.push(i)
        worked.set(need.resourceId, list)
      }
    }
  })
  const out = new Map<string, number>()
  for (const id of resourceIds) {
    const w = worked.get(id) || []
    let n = 0
    for (let i = 0; i < ordered.length; i++) if (doodStatusForDay(w, i)) n++
    out.set(id, n)
  }
  return out
}

function companyMoves(days: ShootDayWithScenes[], dayIds: Set<string>) {
  return days
    .filter((d) => dayIds.has(d.id))
    .reduce((n, d) => n + Math.max(0, new Set(d.scenes.map((s) => (s.scene.location_name || '').toUpperCase()).filter(Boolean)).size - 1), 0)
}

/** Scene's story time vs when it would be shot. */
function timeOfDayFits(scene: SceneRow, start: number) {
  const t = ((start % 1440) + 1440) % 1440
  const tod = scene.time_of_day
  const isExt = scene.int_ext === 'EXT' || scene.int_ext === 'INT_EXT'
  if (!isExt) return true // interiors can be lit for any time
  if (tod === 'NIGHT') return t >= 18 * 60 || t < 5 * 60
  if (tod === 'DAY') return t >= 6 * 60 && t < 18 * 60
  if (tod === 'DAWN') return t >= 4 * 60 + 30 && t < 8 * 60
  if (tod === 'DUSK') return t >= 16 * 60 + 30 && t < 20 * 60
  return true
}

const label = (d: ShootDayWithScenes) =>
  `Day ${d.day_number ?? '?'} (${new Date(`${d.shoot_date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })})`

interface Scored {
  ops: PlanOp[]
  after: ProjectScheduleData
  evalAfter: Evaluation
  fixes: number
  newIssues: string[]
  paidDaysSaved: number
  costSaved: number
  movesDelta: number
}

function score(
  base: ProjectScheduleData,
  evalBefore: Evaluation,
  ops: PlanOp[],
  c: ScheduleConstraints,
  touchedScenes: string[],
  touchedDays: Set<string>
): Scored {
  const after = simulate(base, ops)
  const evalAfter = evaluate(after.shootDays, c)
  const fixes = [...evalBefore.critical.keys()].filter((id) => !evalAfter.critical.has(id)).length
  const newIssues = [...evalAfter.critical.values()].filter((x) => !evalBefore.critical.has(x.id)).map((x) => x.title)

  const people = new Set(touchedScenes.flatMap((id) => (c.needsByScene.get(id) || []).map((n) => n.resourceId)))
  const before = paidDays(base.shootDays, c, people)
  const afterDays = paidDays(after.shootDays, c, people)
  let paidDaysSaved = 0
  let costSaved = 0
  for (const id of people) {
    const delta = (before.get(id) || 0) - (afterDays.get(id) || 0)
    paidDaysSaved += delta
    costSaved += delta * (c.dayRates.get(id) || 0)
  }
  const movesDelta = companyMoves(after.shootDays, touchedDays) - companyMoves(base.shootDays, touchedDays)
  return { ops, after, evalAfter, fixes, newIssues, paidDaysSaved, costSaved, movesDelta }
}

function wrapLine(d: ShootDayWithScenes, before: DayTimeline | undefined, after: DayTimeline | undefined) {
  if (!after) return null
  const planned = after.plannedWrap
  const est = after.estimatedWrap
  const was = before?.slots.length ? ` (was ${minutesToLabel(before.estimatedWrap)})` : ''
  const over = planned !== null && est > planned ? ` — ${est - planned} min past planned wrap` : ''
  return `Day ${d.day_number ?? '?'} wraps ~${minutesToLabel(est)}${was}${over}`
}

function savingsLine(s: Scored, currency: string) {
  if (s.paidDaysSaved <= 0) return null
  const money =
    s.costSaved > 0
      ? ` (≈ ${new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(s.costSaved)})`
      : ''
  return `${s.paidDaysSaved} paid cast/crew day${s.paidDaysSaved === 1 ? '' : 's'} saved${money}`
}

// ---------------------------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------------------------

/** Best fixes for one conflict: reorder the day, move a scene to another day, or unschedule. */
export function suggestFixes(
  data: ProjectScheduleData,
  c: ScheduleConstraints,
  conflict: ScheduleConflict,
  currency = 'USD'
): Suggestion[] {
  const evalBefore = evaluate(data.shootDays, c)
  const day = data.shootDays.find((d) => d.id === conflict.dayId)
  if (!day) return []
  const results: Suggestion[] = []
  const targetGone = (s: Scored) => !s.evalAfter.critical.has(conflict.id) && !s.evalAfter.warnings.has(conflict.id)

  // Which scenes may move: the conflicted one first, then others on the day (for wrap/late-start issues)
  const movable = conflict.sceneId
    ? [conflict.sceneId, ...day.scenes.map((s) => s.scene.id).filter((id) => id !== conflict.sceneId)]
    : day.scenes.map((s) => s.scene.id)

  // 1. Reorder within the day
  if (!day.is_locked) {
    const ids = day.scenes.map((s) => s.scene.id)
    const reorders: Scored[] = []
    for (const sceneId of movable.slice(0, 8)) {
      const from = ids.indexOf(sceneId)
      for (let to = 0; to < ids.length; to++) {
        if (to === from) continue
        const order = ids.filter((id) => id !== sceneId)
        order.splice(to, 0, sceneId)
        const s = score(data, evalBefore, [{ type: 'ORDER', dayId: day.id, sceneIds: order }], c, [sceneId], new Set([day.id]))
        if (targetGone(s) && s.newIssues.length === 0) reorders.push(s)
      }
    }
    reorders
      .sort((a, b) => b.fixes - a.fixes || (a.evalAfter.timelines.get(day.id)?.estimatedWrap ?? 0) - (b.evalAfter.timelines.get(day.id)?.estimatedWrap ?? 0))
      .slice(0, 2)
      .forEach((s, i) => {
        const op = s.ops[0] as Extract<PlanOp, { type: 'ORDER' }>
        const tl = s.evalAfter.timelines.get(day.id)
        const sceneNo = (id: string) => day.scenes.find((x) => x.scene.id === id)?.scene.scene_number
        const moved = movable.find((id) => op.sceneIds.indexOf(id) !== day.scenes.findIndex((x) => x.scene.id === id)) || movable[0]
        const slot = tl?.slots.find((x) => x.sceneId === moved)
        results.push({
          id: `reorder-${i}`,
          kind: 'REORDER',
          title: `Reorder Day ${day.day_number}: shoot Sc ${sceneNo(moved)}${slot ? ` at ~${minutesToLabel(slot.start)}` : ''}`,
          details: [
            `New order: ${op.sceneIds.map((id) => `Sc ${sceneNo(id)}`).join(' → ')}`,
            wrapLine(day, evalBefore.timelines.get(day.id), tl),
            'No change to other days',
          ].filter((x): x is string => !!x),
          impact: { fixes: s.fixes, newIssues: [], paidDaysSaved: 0, costSaved: 0, companyMovesDelta: s.movesDelta },
          ops: s.ops,
          // Least disruptive: nothing leaves the day, so it outranks moves with equal fixes
          score: 1000 * s.fixes - 40 * s.movesDelta + 600 - i,
        })
      })
  }

  // 2. Move a scene to another day (nearest dates first; same location & same people preferred)
  const others = data.shootDays
    .filter((d) => d.id !== day.id && !d.is_locked)
    .sort((a, b) => Math.abs(Date.parse(a.shoot_date) - Date.parse(day.shoot_date)) - Math.abs(Date.parse(b.shoot_date) - Date.parse(day.shoot_date)))
    .slice(0, 40)
  const moves: Array<Scored & { sceneId: string; to: ShootDayWithScenes }> = []
  for (const sceneId of movable.slice(0, conflict.sceneId ? 1 : 4)) {
    const scene = day.scenes.find((s) => s.scene.id === sceneId)!.scene
    for (const to of others) {
      // Place it next to scenes at the same location, else at the end
      const order = to.scenes.map((s) => s.scene.id)
      const sameLoc = to.scenes.map((s) => (s.scene.location_name || '').toUpperCase()).lastIndexOf((scene.location_name || '').toUpperCase())
      order.splice(sameLoc >= 0 ? sameLoc + 1 : order.length, 0, sceneId)
      const ops: PlanOp[] = [
        { type: 'MOVE', sceneId, toDayId: to.id },
        { type: 'ORDER', dayId: to.id, sceneIds: order },
      ]
      const s = score(data, evalBefore, ops, c, [sceneId], new Set([day.id, to.id]))
      const slot = s.evalAfter.timelines.get(to.id)?.slots.find((x) => x.sceneId === sceneId)
      if (!targetGone(s) || s.newIssues.length || (slot && !timeOfDayFits(scene, slot.start))) continue
      moves.push({ ...s, sceneId, to })
    }
  }
  moves
    .map((m) => {
      const scene = day.scenes.find((s) => s.scene.id === m.sceneId)!.scene
      const sameLocation = m.to.scenes.some((s) => (s.scene.location_name || '').toUpperCase() === (scene.location_name || '').toUpperCase())
      const needs = c.needsByScene.get(m.sceneId) || []
      const alreadyThere = needs.filter((n) =>
        m.to.scenes.some((s) => (c.needsByScene.get(s.scene.id) || []).some((x) => x.resourceId === n.resourceId))
      )
      const daysAway = Math.round(Math.abs(Date.parse(m.to.shoot_date) - Date.parse(day.shoot_date)) / 86400000)
      return {
        m,
        scene,
        sameLocation,
        alreadyThere,
        score: 1000 * m.fixes + 200 * m.paidDaysSaved + (sameLocation ? 120 : 0) + 30 * alreadyThere.length - 60 * m.movesDelta - 3 * daysAway + 200,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .forEach(({ m, scene, sameLocation, alreadyThere, score: sc }, i) => {
      const slot = m.evalAfter.timelines.get(m.to.id)?.slots.find((x) => x.sceneId === m.sceneId)
      results.push({
        id: `move-${i}`,
        kind: 'MOVE_DAY',
        title: `Move Sc ${scene.scene_number} to ${label(m.to)}${slot ? ` at ~${minutesToLabel(slot.start)}` : ''}`,
        details: [
          sameLocation ? 'Same location as that day’s other scenes — no extra company move' : null,
          alreadyThere.length ? `${alreadyThere.map((n) => n.character || n.name).join(', ')} already working that day` : null,
          savingsLine(m, currency),
          wrapLine(m.to, evalBefore.timelines.get(m.to.id), m.evalAfter.timelines.get(m.to.id)),
        ].filter((x): x is string => !!x),
        impact: {
          fixes: m.fixes,
          newIssues: [],
          paidDaysSaved: m.paidDaysSaved,
          costSaved: m.costSaved,
          companyMovesDelta: m.movesDelta,
        },
        ops: m.ops,
        score: sc,
      })
    })

  // 3. Always possible: back to the pool
  if (conflict.sceneId) {
    const s = score(data, evalBefore, [{ type: 'MOVE', sceneId: conflict.sceneId, toDayId: null }], c, [conflict.sceneId], new Set([day.id]))
    const scene = day.scenes.find((x) => x.scene.id === conflict.sceneId)?.scene
    results.push({
      id: 'to-pool',
      kind: 'TO_POOL',
      title: `Unschedule Sc ${scene?.scene_number} for now`,
      details: ['Moves it back to the unscheduled pool to place later', savingsLine(s, currency)].filter((x): x is string => !!x),
      impact: { fixes: s.fixes, newIssues: s.newIssues, paidDaysSaved: s.paidDaysSaved, costSaved: s.costSaved, companyMovesDelta: s.movesDelta },
      ops: s.ops,
      score: 1000 * s.fixes - 500,
    })
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * "We have spare time": scenes from later days or the pool that can be shot on `dayId` now,
 * with the people and places available, filling about `minutes` starting at `atMinute`
 * (default: the day's first idle gap, or the end of the day).
 */
export function suggestFill(
  data: ProjectScheduleData,
  c: ScheduleConstraints,
  dayId: string,
  minutes: number,
  currency = 'USD'
): Suggestion[] {
  const evalBefore = evaluate(data.shootDays, c)
  const day = data.shootDays.find((d) => d.id === dayId)
  if (!day || day.is_locked) return []
  const tl = evalBefore.timelines.get(day.id)
  const gap = tl?.gaps.slice().sort((a, b) => b.end - b.start - (a.end - a.start))[0]
  // Insert before the scene that follows the idle gap, else at the end
  const insertAt = gap ? day.scenes.findIndex((s) => s.scene.id === gap.beforeSceneId) : day.scenes.length

  const onSetToday = new Set(day.scenes.flatMap((s) => (c.needsByScene.get(s.scene.id) || []).map((n) => n.resourceId)))
  const locationsToday = new Set(day.scenes.map((s) => (s.scene.location_name || '').toUpperCase()).filter(Boolean))

  const laterDays = data.shootDays.filter((d) => d.shoot_date > day.shoot_date && !d.is_locked)
  const candidates: Array<{ scene: SceneRow; from: ShootDayWithScenes | null; mins: number }> = [
    ...laterDays.flatMap((d) => d.scenes.map((s) => ({ scene: s.scene, from: d as ShootDayWithScenes | null, mins: s.estimatedMinutes || 30 }))),
    ...data.unscheduledScenes.map((s) => ({ scene: s, from: null, mins: s.estimated_duration || 30 })),
  ].filter((x) => x.mins <= minutes + 15)

  const scored = candidates
    .map((cand) => {
      const order = day.scenes.map((s) => s.scene.id)
      order.splice(insertAt, 0, cand.scene.id)
      const ops: PlanOp[] = [
        { type: 'MOVE', sceneId: cand.scene.id, toDayId: day.id },
        { type: 'ORDER', dayId: day.id, sceneIds: order },
      ]
      const touched = new Set([day.id, ...(cand.from ? [cand.from.id] : [])])
      const s = score(data, evalBefore, ops, c, [cand.scene.id], touched)
      const slot = s.evalAfter.timelines.get(day.id)?.slots.find((x) => x.sceneId === cand.scene.id)
      if (s.newIssues.length || (slot && !timeOfDayFits(cand.scene, slot.start))) return null
      const needs = c.needsByScene.get(cand.scene.id) || []
      const extraPeople = needs.filter((n) => n.type === 'PERSON' && !onSetToday.has(n.resourceId))
      const sameLocation = locationsToday.has((cand.scene.location_name || '').toUpperCase())
      const fit = 1 - Math.abs(minutes - cand.mins) / Math.max(minutes, 1)
      return {
        cand,
        s,
        slot,
        extraPeople,
        sameLocation,
        needs,
        rank: 200 * s.paidDaysSaved + (sameLocation ? 150 : 0) - 60 * extraPeople.length - 40 * Math.max(0, s.movesDelta) + 80 * fit + (cand.from ? 20 : 0),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6)

  return scored.map(({ cand, s, slot, extraPeople, sameLocation, needs, rank }, i) => {
    const people = needs.filter((n) => n.type === 'PERSON')
    return {
      id: `fill-${i}`,
      kind: 'FILL' as const,
      title: `Shoot Sc ${cand.scene.scene_number} ${cand.from ? `now (from ${label(cand.from)})` : '(from the unscheduled pool)'}${
        slot ? ` at ~${minutesToLabel(slot.start)}` : ''
      }`,
      details: [
        `${cand.scene.heading || 'Untitled scene'} · ${cand.mins} min`,
        people.length === 0
          ? 'No cast needed'
          : extraPeople.length === 0
            ? `Needs ${people.map((n) => n.character || n.name).join(', ')} — already on set`
            : `Also call ${extraPeople.map((n) => n.character ? `${n.name} (${n.character})` : n.name).join(', ')}`,
        sameLocation ? 'Same location as today — no company move' : null,
        cand.from ? `${label(cand.from)} gets ${cand.mins} min lighter` : null,
        savingsLine(s, currency),
      ].filter((x): x is string => !!x),
      impact: {
        fixes: s.fixes,
        newIssues: [],
        paidDaysSaved: s.paidDaysSaved,
        costSaved: s.costSaved,
        companyMovesDelta: s.movesDelta,
        minutesFilled: cand.mins,
      },
      ops: s.ops,
      score: rank,
    }
  })
}

/** Free time on a day: idle gap before a pinned scene, else time left before the planned wrap. */
export function freeMinutes(tl: DayTimeline | undefined): number {
  if (!tl) return 60
  if (tl.gaps.length) return Math.max(...tl.gaps.map((g) => g.end - g.start))
  if (tl.plannedWrap !== null && tl.plannedWrap > tl.estimatedWrap) return tl.plannedWrap - tl.estimatedWrap
  return 60
}
