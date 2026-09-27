'use client'

import type { PlanOp } from './suggestions'
import {
  assignSceneToDayAction,
  removeSceneFromDayAction,
  reorderDayScenesAction,
  type ProjectScheduleData,
} from '../actions'
import { saveScheduleVersionAction } from '@/features/versioning/actions'
import { logActivityAction } from '@/features/collaboration/actions'

/**
 * Carry out a suggestion. A schedule version is saved first so it can be undone from the
 * version switcher; moves keep the scene's minutes; bookings re-sync through the actions.
 */
export async function applyPlan(
  projectId: string,
  schedule: ProjectScheduleData,
  ops: PlanOp[],
  title: string
): Promise<{ success: boolean; error?: string }> {
  const backup = await saveScheduleVersionAction(projectId, `Before: ${title}`.slice(0, 120), 'WHITE', 'Automatic backup before applying a suggestion')
  if (!backup.success) return { success: false, error: backup.error || 'Could not save a backup version' }

  const dayOf = (sceneId: string) => schedule.shootDays.find((d) => d.scenes.some((s) => s.scene.id === sceneId))?.id

  for (const op of ops) {
    if (op.type === 'MOVE') {
      if (op.toDayId === null) {
        const from = dayOf(op.sceneId)
        if (from) {
          const res = await removeSceneFromDayAction(from, op.sceneId)
          if (!res.success) return res
        }
      } else {
        const res = await assignSceneToDayAction(op.toDayId, op.sceneId, 999)
        if (!res.success) return res
      }
    } else {
      const res = await reorderDayScenesAction(op.dayId, op.sceneIds)
      if (!res.success) return res
    }
  }

  logActivityAction(projectId, 'SCHEDULE_MOVE', title, 'Applied from schedule suggestions')
  return { success: true }
}
