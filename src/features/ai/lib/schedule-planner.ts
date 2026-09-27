/**
 * Deterministic schedule re-planning used by the schedule assistant.
 * Pure functions: the same schedule always yields the same proposal, so "Apply" re-computes the
 * plan server-side instead of trusting anything sent from the browser.
 */
import type { ShootDayWithScenes } from '@/features/scheduling/actions'
import { detectScheduleConflicts } from '@/features/scheduling/lib/conflict-detector'

export interface LocationClusterPlan {
  /** shoot_day_id → ordered scene ids */
  assignments: Map<string, string[]>
  movesBefore: number
  movesAfter: number
  emptiedDays: number
  days: Array<{ dayNumber: number; locations: string[]; sceneCount: number; minutes: number }>
}

const locationOf = (s: ShootDayWithScenes['scenes'][number]) =>
  (s.scene.location_name || 'UNSPECIFIED').trim().toUpperCase()

export function countCompanyMoves(days: ShootDayWithScenes[]) {
  return days.reduce((sum, d) => sum + Math.max(0, new Set(d.scenes.map(locationOf)).size - 1), 0)
}

/**
 * Re-pack every scene on unlocked days so each location is shot in one block, filling days in
 * date order up to the daily shooting limit. Locked days are left exactly as they are.
 */
export function planLocationClusters(days: ShootDayWithScenes[], maxMinutesPerDay: number): LocationClusterPlan {
  const ordered = [...days].sort((a, b) => a.shoot_date.localeCompare(b.shoot_date))
  const open = ordered.filter((d) => !d.is_locked)
  const pool = open.flatMap((d) => d.scenes)

  // Group by location, keeping the order each location first appears in the current schedule
  const groups = new Map<string, typeof pool>()
  for (const s of pool) {
    const key = locationOf(s)
    groups.set(key, [...(groups.get(key) || []), s])
  }

  const assignments = new Map<string, string[]>(ordered.map((d) => [d.id, d.is_locked ? d.scenes.map((s) => s.scene.id) : []]))
  const minutes = new Map<string, number>(open.map((d) => [d.id, 0]))
  let cursor = 0
  for (const scenes of groups.values()) {
    for (const s of scenes) {
      const mins = s.estimatedMinutes || 30
      // advance to a day with room (the last open day absorbs any overflow)
      while (cursor < open.length - 1 && (minutes.get(open[cursor].id) || 0) + mins > maxMinutesPerDay) cursor++
      const day = open[cursor]
      if (!day) break
      assignments.get(day.id)!.push(s.scene.id)
      minutes.set(day.id, (minutes.get(day.id) || 0) + mins)
    }
  }

  const byId = new Map(pool.map((s) => [s.scene.id, s]))
  const planned: ShootDayWithScenes[] = ordered.map((d) =>
    d.is_locked
      ? d
      : { ...d, scenes: (assignments.get(d.id) || []).map((id) => byId.get(id)!).filter(Boolean) }
  )

  return {
    assignments,
    movesBefore: countCompanyMoves(ordered),
    movesAfter: countCompanyMoves(planned),
    emptiedDays: open.filter((d) => d.scenes.length > 0 && (assignments.get(d.id) || []).length === 0).length,
    days: planned.map((d, i) => ({
      dayNumber: d.day_number || i + 1,
      locations: Array.from(new Set(d.scenes.map(locationOf))),
      sceneCount: d.scenes.length,
      minutes: d.scenes.reduce((m, s) => m + (s.estimatedMinutes || 30), 0),
    })),
  }
}

/** Call-time changes that clear every 12-hour turnaround violation the conflict engine finds. */
export function planTurnaroundFixes(days: ShootDayWithScenes[]) {
  return detectScheduleConflicts(days)
    .filter((c) => c.type === 'TURNAROUND' && c.quickFix?.suggestedCallTime)
    .map((c) => ({ dayId: c.dayId, dayNumber: c.dayNumber, newCallTime: c.quickFix!.suggestedCallTime! }))
}
