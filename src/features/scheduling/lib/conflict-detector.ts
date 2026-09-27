import type { ShootDayWithScenes } from '../actions'
import type { Database } from '@/types/database'

export type ConflictSeverity = 'CRITICAL' | 'WARNING' | 'INFO'
export type ConflictType = 'TURNAROUND' | 'OVERRUN' | 'FLIP_FLOP' | 'EMPTY_DAY' | 'LOCATION' | 'CAST' | 'RESOURCE_UNAVAILABLE'

export interface QuickFixAction {
  label: string
  actionType: 'ADJUST_CALL_TIME' | 'UNASSIGN_SCENE' | 'DELETE_DAY'
  dayId: string
  suggestedCallTime?: string
  sceneId?: string
}

export interface ScheduleConflict {
  id: string
  severity: ConflictSeverity
  type: ConflictType
  dayId: string
  dayNumber: number
  title: string
  description: string
  sceneId?: string
  quickFix?: QuickFixAction
}

/**
 * Helper to parse date string and time string into a Date object
 */
function parseDateTime(dateStr: string, timeStr: string): Date {
  // normalize time string (e.g. "07:00:00" or "07:00")
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10) || 0)
  const date = new Date(dateStr)
  date.setHours(h, m, 0, 0)
  return date
}

/**
 * Format Date object to HH:MM time string
 */
function formatTimeHHMM(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Real-time deterministic conflict detection engine for film production schedule
 */
export function detectScheduleConflicts(
  shootDays: ShootDayWithScenes[],
  unscheduledScenes: Database['public']['Tables']['scenes']['Row'][] = []
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []

  // Sort shoot days by day_number ascending
  const sortedDays = [...shootDays].sort((a, b) => (a.day_number || 0) - (b.day_number || 0))

  sortedDays.forEach((day, index) => {
    const dayNum = day.day_number || index + 1
    const callTimeStr = day.call_time ? day.call_time.slice(0, 5) : '07:00'
    const callDateTime = parseDateTime(day.shoot_date, callTimeStr)

    // Calculate estimated wrap time
    // Total duration in minutes + 60 min meal break if total duration > 6 hours
    const shootingMins = day.totalEstimatedMinutes || 0
    const mealMins = shootingMins > 360 ? 60 : 0
    const totalDayMins = shootingMins + mealMins

    const wrapDateTime = new Date(callDateTime.getTime() + totalDayMins * 60 * 1000)
    const wrapTimeStr = formatTimeHHMM(wrapDateTime)

    // ----------------------------------------------------
    // 1. EMPTY DAY CHECK
    // ----------------------------------------------------
    if (day.scenes.length === 0) {
      conflicts.push({
        id: `empty-day-${day.id}`,
        severity: 'INFO',
        type: 'EMPTY_DAY',
        dayId: day.id,
        dayNumber: dayNum,
        title: `Empty Shoot Day (Day ${dayNum})`,
        description: `No scenes scheduled on Day ${dayNum}. Assign scenes from the unscheduled pool or delete empty day.`,
        quickFix: {
          label: `Delete Day ${dayNum}`,
          actionType: 'DELETE_DAY',
          dayId: day.id,
        },
      })
    }

    // ----------------------------------------------------
    // 2. DAILY WORKING HOURS OVER-RUN (> 12 HOURS)
    // ----------------------------------------------------
    const totalHours = shootingMins / 60
    if (totalHours > 12) {
      conflicts.push({
        id: `overrun-${day.id}`,
        severity: 'WARNING',
        type: 'OVERRUN',
        dayId: day.id,
        dayNumber: dayNum,
        title: `Over-scheduled Shoot Day (Day ${dayNum})`,
        description: `Day ${dayNum} total estimated shooting time is ${totalHours.toFixed(1)}h (${shootingMins} mins), exceeding the 12-hour daily limit.`,
      })
    }

    // ----------------------------------------------------
    // 3. HIGH LOCATION MOVE COUNT (> 3 LOCATIONS)
    // ----------------------------------------------------
    const uniqueLocations = Array.from(
      new Set(
        day.scenes
          .map((s) => (s.scene.location_name || '').trim())
          .filter(Boolean)
      )
    )

    if (uniqueLocations.length > 3) {
      conflicts.push({
        id: `location-move-${day.id}`,
        severity: 'WARNING',
        type: 'LOCATION',
        dayId: day.id,
        dayNumber: dayNum,
        title: `High Company Move Overhead (Day ${dayNum})`,
        description: `Day ${dayNum} includes ${uniqueLocations.length} distinct locations (${uniqueLocations.join(', ')}). Multiple location moves add significant setup delays.`,
      })
    }

    // ----------------------------------------------------
    // 4. CONSECUTIVE DAY CHECKS (TURNAROUND & FLIP-FLOP)
    // ----------------------------------------------------
    if (index < sortedDays.length - 1) {
      const nextDay = sortedDays[index + 1]
      const nextDayNum = nextDay.day_number || index + 2
      const nextCallTimeStr = nextDay.call_time ? nextDay.call_time.slice(0, 5) : '07:00'
      const nextCallDateTime = parseDateTime(nextDay.shoot_date, nextCallTimeStr)

      // Calculate turnaround rest period in hours
      const restMs = nextCallDateTime.getTime() - wrapDateTime.getTime()
      const restHours = restMs / (1000 * 60 * 60)

      // SAG-AFTRA / IATSE 12-hour turnaround rule check
      if (restHours < 12 && day.scenes.length > 0 && nextDay.scenes.length > 0) {
        // Calculate recommended next call time (wrap time + 12 hours)
        const minCallDateTime = new Date(wrapDateTime.getTime() + 12 * 60 * 60 * 1000)
        const suggestedCallTime = formatTimeHHMM(minCallDateTime)

        conflicts.push({
          id: `turnaround-${day.id}-${nextDay.id}`,
          severity: 'CRITICAL',
          type: 'TURNAROUND',
          dayId: nextDay.id,
          dayNumber: nextDayNum,
          title: `Turnaround Violation (Day ${dayNum} → Day ${nextDayNum})`,
          description: `Only ${Math.max(0, restHours).toFixed(1)}h rest between Day ${dayNum} wrap (${wrapTimeStr}) and Day ${nextDayNum} call (${nextCallTimeStr}). Industry standard requires 12h minimum.`,
          quickFix: {
            label: `Adjust Day ${nextDayNum} Call Time to ${suggestedCallTime}`,
            actionType: 'ADJUST_CALL_TIME',
            dayId: nextDay.id,
            suggestedCallTime,
          },
        })
      }

      // Night-to-Day Flip-flop Warning
      const dayHasNight = day.scenes.some(
        (s) => s.scene.time_of_day === 'NIGHT' || s.scene.time_of_day === 'DUSK'
      )
      const nextDayHasDay = nextDay.scenes.some(
        (s) => s.scene.time_of_day === 'DAY' || s.scene.time_of_day === 'DAWN'
      )

      if (dayHasNight && nextDayHasDay && restHours < 20) {
        conflicts.push({
          id: `flipflop-${day.id}-${nextDay.id}`,
          severity: 'WARNING',
          type: 'FLIP_FLOP',
          dayId: nextDay.id,
          dayNumber: nextDayNum,
          title: `Night-to-Day Flip-Flop (Day ${dayNum} → Day ${nextDayNum})`,
          description: `Rapid transition from Night shoot on Day ${dayNum} to Day shoot on Day ${nextDayNum} with only ${Math.max(0, restHours).toFixed(1)}h rest. Consider adding a turnaround day.`,
        })
      }
    }
  })

  return conflicts
}
