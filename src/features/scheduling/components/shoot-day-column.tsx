'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import type { DayTimeline } from '../lib/day-timeline'
import { minutesToLabel } from '../lib/time'
import { logActivityAction } from '@/features/collaboration/actions'
import { useFeedback } from '@/components/ui/feedback-provider'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ShootDayWithScenes } from '../actions'
import type { ScheduleConflict } from '../lib/conflict-detector'
import {
  updateShootDayAction,
  deleteShootDayAction,
  removeSceneFromDayAction,
  reorderDayScenesAction,
  updateSceneMinutesAction,
  setSceneFixedStartAction,
} from '../actions'
import { StripboardStrip } from './stripboard-strip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Clock,
  Lock,
  Unlock,
  Trash2,
  FileText,
  Plus,
  Layers,
  AlertTriangle,
  Sparkles,
  CalendarPlus,
  FileWarning,
} from 'lucide-react'

interface ShootDayColumnProps {
  day: ShootDayWithScenes
  conflicts?: ScheduleConflict[]
  onRefresh: () => void
  onAssignScenePrompt?: (dayId: string) => void
  onOpenInspector?: () => void
  /** Running order (scene time slots, meal, estimated wrap) */
  timeline?: DayTimeline
  /** Open fix suggestions for a conflict */
  onFindFixes?: (conflict: ScheduleConflict) => void
  /** Open "use free time" suggestions for this day */
  onFillTime?: (dayId: string) => void
  /** Change this day's date (push / move only) */
  onEditDate?: (dayId: string) => void
  /** Insert a day off after this day (later days push one working day) */
  onInsertDayOff?: (dayId: string) => void
  /** Shot, shooting, cancelled or locked: the date can't change */
  dateFixed?: boolean
  /** The published call sheet shows a different date than this day now has */
  callSheetStale?: boolean
}

export function ShootDayColumn({
  day,
  conflicts = [],
  onRefresh,
  onAssignScenePrompt,
  onOpenInspector,
  timeline,
  onFindFixes,
  onFillTime,
  onEditDate,
  onInsertDayOff,
  dateFixed = false,
  callSheetStale = false,
}: ShootDayColumnProps) {
  const { confirm, notify } = useFeedback()
  const [isDeleting, setIsDeleting] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: day.id,
    data: {
      type: 'day',
      dayId: day.id,
    },
  })

  const sceneIds = useMemo(() => day.scenes.map((s) => s.scene.id), [day.scenes])

  // Filter conflicts for this day
  const dayConflicts = useMemo(() => {
    return conflicts.filter((c) => c.dayId === day.id)
  }, [conflicts, day.id])

  const hasCritical = dayConflicts.some((c) => c.severity === 'CRITICAL')
  const hasWarning = dayConflicts.some((c) => c.severity === 'WARNING')

  // Calculate total pages assigned to this day
  const totalPages = day.scenes.reduce((sum, item) => {
    const start = item.scene.page_start || 1
    const end = item.scene.page_end || start
    const count = Math.max(0.1, end - start + 0.1)
    return sum + count
  }, 0)

  // Toggle Day Lock
  const handleToggleLock = async () => {
    await updateShootDayAction(day.id, { isLocked: !day.is_locked })
    onRefresh()
  }

  // Delete Shoot Day
  const handleDeleteDay = async () => {
    const ok = await confirm({
      title: `Delete Shoot Day ${day.day_number}?`,
      message: `Its ${day.scenes.length} scene(s) go back to the unscheduled pool, and bookings for this day are removed.`,
      confirmLabel: 'Delete day',
      destructive: true,
    })
    if (ok) {
      setIsDeleting(true)
      const res = await deleteShootDayAction(day.id)
      if (res.success) logActivityAction(day.project_id, 'SHOOT_DAY_DELETED', `Deleted Day ${day.day_number}`, day.shoot_date)
      setIsDeleting(false)
      onRefresh()
    }
  }

  // Remove Scene from Day
  const handleRemoveScene = async (sceneId: string) => {
    await removeSceneFromDayAction(day.id, sceneId)
    onRefresh()
  }

  // Move Scene Up / Down in Day
  const handleMoveScene = async (currentIndex: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= day.scenes.length) return

    const orderedIds = day.scenes.map((s) => s.scene.id)
    const temp = orderedIds[currentIndex]
    orderedIds[currentIndex] = orderedIds[targetIndex]
    orderedIds[targetIndex] = temp

    await reorderDayScenesAction(day.id, orderedIds)
    onRefresh()
  }

  // Update Call Time
  const handleCallTimeChange = async (newTime: string) => {
    await updateShootDayAction(day.id, { callTime: newTime })
    onRefresh()
  }

  // Update planned wrap (empty clears it)
  const handleWrapTimeChange = async (newTime: string) => {
    await updateShootDayAction(day.id, { wrapTime: newTime })
    onRefresh()
  }

  const handleMinutesChange = async (sceneId: string, minutes: number) => {
    const res = await updateSceneMinutesAction(day.id, sceneId, minutes)
    if (!res.success) notify(res.error || 'Could not update the time', 'error')
    onRefresh()
  }

  const handleFixedStartChange = async (sceneId: string, time: string | null) => {
    const res = await setSceneFixedStartAction(day.id, sceneId, time)
    if (!res.success) notify(res.error || 'Could not set the start time', 'error')
    onRefresh()
  }

  const slotBySceneId = new Map((timeline?.slots || []).map((s) => [s.sceneId, s]))
  const conflictsByScene = new Map<string, ScheduleConflict[]>()
  for (const c of conflicts) {
    if (c.dayId === day.id && c.sceneId) conflictsByScene.set(c.sceneId, [...(conflictsByScene.get(c.sceneId) || []), c])
  }
  const overPlannedWrap =
    timeline && timeline.plannedWrap !== null && timeline.slots.length > 0 && timeline.estimatedWrap > timeline.plannedWrap

  return (
    <div
      ref={setNodeRef}
      className={`bg-background border rounded-2xl p-4 shadow-xl flex flex-col space-y-4 min-w-[320px] max-w-[420px] shrink-0 transition-colors ${
        isOver
          ? 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-500/40'
          : hasCritical
          ? 'border-rose-800/80 bg-rose-950/10'
          : hasWarning
          ? 'border-amber-800/60 bg-amber-950/10'
          : day.is_locked
          ? 'border-border/80 bg-background/60'
          : 'border-border'
      }`}
    >
      {/* DAY HEADER */}
      <div className="bg-card/90 border border-border p-3 rounded-xl space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Day Number & Lock */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded">
              DAY {day.day_number || 1}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] font-mono ${
                day.status === 'CONFIRMED'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {day.status}
            </Badge>

            {dayConflicts.length > 0 && (
              <button
                type="button"
                onClick={onOpenInspector}
                className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1 cursor-pointer transition-colors ${
                  hasCritical
                    ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300 hover:bg-rose-500/30'
                    : 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30'
                }`}
                title="Click to inspect conflicts"
              >
                <AlertTriangle className="size-3" />
                <span>{dayConflicts.length} Alert{dayConflicts.length > 1 ? 's' : ''}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onInsertDayOff && (
              <button
                type="button"
                onClick={() => onInsertDayOff(day.id)}
                className="p-1.5 text-faint hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer"
                title="Insert a day off after this day (later days move one working day)"
                aria-label="Insert a day off after this day"
              >
                <CalendarPlus className="size-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleLock}
              className={`p-1.5 rounded transition-colors ${
                day.is_locked
                  ? 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/30'
                  : 'text-faint hover:text-subtle-foreground'
              }`}
              title={day.is_locked ? 'Day Locked' : 'Lock Day'}
            >
              {day.is_locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </button>

            <button
              type="button"
              onClick={handleDeleteDay}
              disabled={isDeleting}
              className="p-1.5 text-faint hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
              title="Delete Day"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Date & Call Time Inputs */}
        <div className="flex items-center justify-between gap-2 text-xs font-mono text-muted-foreground pt-1 border-t border-border/60">
          <button
            type="button"
            onClick={() => onEditDate?.(day.id)}
            disabled={!onEditDate || dateFixed}
            className="group flex items-center gap-1.5 -ml-1 px-1 py-0.5 rounded border border-transparent enabled:hover:border-amber-500/50 enabled:hover:bg-amber-500/10 enabled:hover:text-foreground enabled:cursor-pointer disabled:cursor-default transition-colors"
            title={dateFixed ? 'Shot, shooting or locked — unlock the day to change its date' : 'Change date (push later days or move only this day)'}
          >
            <Calendar className="size-3 text-amber-600 dark:text-amber-500" />
            <span className="underline decoration-dotted decoration-border underline-offset-2 group-disabled:no-underline">
              {new Date(`${day.shoot_date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <label className="flex items-center gap-1" title="Crew call (set by the AD)">
              <Clock className="size-3 text-blue-700 dark:text-blue-400" />
              <span className="sr-only">Crew call</span>
              <input
                type="time"
                value={day.call_time?.slice(0, 5) || '07:00'}
                onChange={(e) => handleCallTimeChange(e.target.value)}
                className="bg-background border border-border rounded px-1.5 py-0.5 text-foreground text-[11px] font-mono focus:outline-none focus:border-amber-500"
              />
            </label>
            <span aria-hidden>→</span>
            <label className="flex items-center gap-1" title="Planned wrap (optional)">
              <span className="sr-only">Planned wrap</span>
              <input
                type="time"
                value={day.wrap_time?.slice(0, 5) || ''}
                onChange={(e) => handleWrapTimeChange(e.target.value)}
                className={`bg-background border rounded px-1.5 py-0.5 text-[11px] font-mono focus:outline-none focus:border-amber-500 ${
                  day.wrap_time ? 'border-border text-foreground' : 'border-dashed border-border text-muted-foreground'
                }`}
              />
            </label>
          </div>
        </div>

        {callSheetStale && (
          <Link
            href={`/projects/${day.project_id}/callsheets`}
            className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
            title="The crew has a call sheet with the old date"
          >
            <FileWarning className="size-3.5" />
            Call sheet shows the old date — republish
          </Link>
        )}

        {/* Day Summary Stats (Pages & Hours) */}
        <div className="flex items-center justify-between text-[11px] font-mono font-bold bg-background p-2 rounded-lg border border-border/80">
          <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <FileText className="size-3 text-amber-600 dark:text-amber-500" />
            {totalPages.toFixed(1)} Pages
          </span>
          <span
            className={`flex items-center gap-1 ${overPlannedWrap ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}
            title={
              timeline
                ? `Estimated from call ${minutesToLabel(timeline.call)}, scene minutes, setup, moves${
                    timeline.meal ? `, lunch ${minutesToLabel(timeline.meal.start)}` : ''
                  }`
                : undefined
            }
          >
            <Clock className="size-3" />
            {timeline && timeline.slots.length
              ? `Wrap ~${minutesToLabel(timeline.estimatedWrap)}${overPlannedWrap ? ` (+${timeline.estimatedWrap - timeline.plannedWrap!}m)` : ''}`
              : `${(day.totalEstimatedMinutes / 60).toFixed(1)} hrs`}
          </span>
          <span className="text-muted-foreground">
            {day.scenes.length} Scenes
          </span>
        </div>
      </div>

      {/* ASSIGNED SCENES LIST */}
      <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar min-h-[120px]">
          {day.scenes.length === 0 ? (
            <div className="p-6 text-center text-faint text-xs font-mono border border-dashed border-border/80 rounded-xl space-y-2">
              <Layers className="size-6 mx-auto text-faint" />
              <p>No scenes scheduled for Day {day.day_number} yet.</p>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 font-mono">Drag scenes here from pool or another day</p>
              {onAssignScenePrompt && (
                <button
                  type="button"
                  onClick={() => onAssignScenePrompt(day.id)}
                  className="px-3 py-1 rounded bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer inline-flex items-center gap-1 mt-1"
                >
                  <Plus className="size-3" />
                  <span>Assign Scene</span>
                </button>
              )}
            </div>
          ) : (
            day.scenes.map((item, idx) => (
              <StripboardStrip
                key={item.scene.id}
                scene={item.scene}
                sourceDayId={day.id}
                estimatedMinutes={item.estimatedMinutes}
                slotLabel={
                  slotBySceneId.get(item.scene.id)
                    ? `${minutesToLabel(slotBySceneId.get(item.scene.id)!.start)}–${minutesToLabel(slotBySceneId.get(item.scene.id)!.end)}`
                    : undefined
                }
                sceneConflicts={conflictsByScene.get(item.scene.id)}
                onChangeMinutes={(m) => handleMinutesChange(item.scene.id, m)}
                fixedStartTime={item.fixedStartTime ?? null}
                onSetFixedStart={(t) => handleFixedStartChange(item.scene.id, t)}
                onFindFixes={onFindFixes}
                onRemove={() => handleRemoveScene(item.scene.id)}
                onMoveUp={idx > 0 ? () => handleMoveScene(idx, 'UP') : undefined}
                onMoveDown={idx < day.scenes.length - 1 ? () => handleMoveScene(idx, 'DOWN') : undefined}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Bottom quick add scene trigger */}
      {onFillTime && !day.is_locked && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onFillTime(day.id)}
          className="w-full border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 text-xs h-8 cursor-pointer"
          title="Find scenes from later days or the pool that can be shot in this day's free time"
        >
          <Sparkles className="size-3 mr-1" />
          <span>
            Use free time
            {timeline?.gaps.length
              ? ` (${timeline.gaps.reduce((m, g) => m + g.end - g.start, 0)} min idle)`
              : timeline && timeline.plannedWrap !== null && timeline.plannedWrap > timeline.estimatedWrap
                ? ` (${timeline.plannedWrap - timeline.estimatedWrap} min before wrap)`
                : ''}
          </span>
        </Button>
      )}
      {day.scenes.length > 0 && onAssignScenePrompt && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAssignScenePrompt(day.id)}
          className="w-full border-border text-muted-foreground hover:text-foreground text-xs font-mono h-8 cursor-pointer"
        >
          <Plus className="size-3 mr-1" />
          <span>Add Scene to Day {day.day_number}</span>
        </Button>
      )}
    </div>
  )
}

