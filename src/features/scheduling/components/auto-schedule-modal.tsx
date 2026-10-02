'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CalendarRange, Loader2, Moon, Sun, Trash2, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { useFeedback } from '@/components/ui/feedback-provider'
import type { ProjectScheduleData } from '../actions'
import { detectAvailabilityConflicts, type ScheduleConstraints } from '../lib/availability-conflicts'
import { formatEighths, planSchedule, type PlanResult } from '../lib/auto-schedule'
import {
  allDayBlocker,
  applyAutoSchedule,
  loadAutoScheduleContext,
  planAsShootDays,
  removeEmptyDays,
  toPlannerScenes,
  type AutoScheduleContext,
} from '../lib/auto-schedule-run'
import { nextDate } from '../lib/time'

interface AutoScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  schedule: ProjectScheduleData | null
  constraints: ScheduleConstraints
  onApplied: () => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const today = () => new Date().toISOString().slice(0, 10)
const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Preview-first planner: options → a full proposed schedule with its numbers → Apply (backup saved). */
export function AutoScheduleModal({ isOpen, onClose, projectId, schedule, constraints, onApplied }: AutoScheduleModalProps) {
  const closeRef = useModalBehavior(isOpen, onClose)
  const { confirm, notify } = useFeedback()
  const [ctx, setCtx] = useState<AutoScheduleContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [pagesPerDay, setPagesPerDay] = useState(5)
  const [maxMoves, setMaxMoves] = useState(2)
  const [daysOff, setDaysOff] = useState<number[]>([0])
  const [rebuildAuto, setRebuildAuto] = useState(false)
  const [removeEmpty, setRemoveEmpty] = useState(true)
  const [startInput, setStartInput] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !schedule) return
    let live = true
    loadAutoScheduleContext(projectId, schedule)
      .then((c) => {
        if (!live) return
        setCtx(c)
        // Days off start from the production calendar's work week
        setDaysOff([0, 1, 2, 3, 4, 5, 6].filter((d) => !c.calendar.workDays.includes(d)))
        setLoadError(null)
      })
      .catch(() => live && setLoadError('Could not load the project settings. Please try again.'))
    return () => {
      live = false
    }
  }, [isOpen, projectId, schedule])

  const deleteIds = useMemo(
    () => (ctx ? [...(rebuildAuto ? ctx.autoDayIds : []), ...(removeEmpty ? ctx.emptyDayIds : [])] : []),
    [ctx, rebuildAuto, removeEmpty]
  )

  const keptDays = useMemo(() => {
    const gone = new Set(deleteIds)
    return (schedule?.shootDays || []).filter((d) => !gone.has(d.id))
  }, [schedule, deleteIds])

  const sceneIdsToPlan = useMemo(() => {
    if (!schedule || !ctx) return new Set<string>()
    const ids = new Set(schedule.unscheduledScenes.map((s) => s.id))
    if (rebuildAuto) {
      const auto = new Set(ctx.autoDayIds)
      schedule.shootDays.filter((d) => auto.has(d.id)).forEach((d) => d.scenes.forEach((s) => ids.add(s.scene.id)))
    }
    return ids
  }, [schedule, ctx, rebuildAuto])

  // New days follow the last day that stays; otherwise the production start (never in the past)
  const defaultStart = useMemo(() => {
    const lastKept = keptDays.filter((d) => d.scenes.length).map((d) => d.shoot_date).sort().pop()
    if (lastKept) return nextDate(lastKept)
    const start = ctx?.projectStart || today()
    return start < today() ? today() : start
  }, [keptDays, ctx])
  const startDate = startInput || defaultStart

  const plan: PlanResult | null = useMemo(() => {
    if (!schedule || !ctx || sceneIdsToPlan.size === 0) return null
    return planSchedule(toPlannerScenes(schedule, sceneIdsToPlan, constraints, ctx.charsPerPage), {
      startDate,
      daysOff,
      pagesPerDay,
      maxMovesPerDay: maxMoves,
      maxShootMinutes: ctx.maxShootMinutes,
      companyMoveMinutes: ctx.companyMoveMinutes,
      // Holidays in the production calendar are never shoot days
      usedDates: new Set([...keptDays.map((d) => d.shoot_date), ...ctx.calendar.holidays.map((h) => h.date)]),
      isBlockedAllDay: allDayBlocker(constraints),
      shootAfter: constraints.shootAfter,
    })
  }, [schedule, ctx, sceneIdsToPlan, constraints, startDate, daysOff, pagesPerDay, maxMoves, keptDays])

  const dayNumbers = useMemo(() => {
    if (!plan || !ctx) return []
    if (ctx.numbersFixed) {
      const max = keptDays.reduce((m, d) => Math.max(m, d.day_number || 0), 0)
      return plan.days.map((_, i) => max + i + 1)
    }
    const all = [...keptDays.map((d) => d.shoot_date), ...plan.days.map((d) => d.date)].sort()
    return plan.days.map((d) => all.indexOf(d.date) + 1)
  }, [plan, ctx, keptDays])

  // Same checks the stripboard runs (hour-level availability, wrap overruns, continuity)
  const conflicts = useMemo(() => {
    if (!plan || !schedule || !ctx) return []
    return detectAvailabilityConflicts(planAsShootDays(plan, schedule, ctx, projectId, dayNumbers), constraints).conflicts
  }, [plan, schedule, ctx, constraints, projectId, dayNumbers])

  if (!isOpen || typeof document === 'undefined') return null

  const scenesById = new Map(
    [...(schedule?.shootDays.flatMap((d) => d.scenes.map((s) => s.scene)) || []), ...(schedule?.unscheduledScenes || [])].map((s) => [s.id, s])
  )
  const totalEighths = plan?.days.reduce((n, d) => n + d.eighths, 0) || 0
  const moves = plan?.days.reduce((n, d) => n + Math.max(0, d.sets.length - 1), 0) || 0
  const nights = plan?.days.filter((d) => d.part === 'NIGHT').length || 0
  const critical = conflicts.filter((c) => c.severity === 'CRITICAL').length

  const handleApply = async () => {
    if (!ctx || !schedule) return
    const parts = [
      plan ? `Create ${plan.days.length} shoot days for ${sceneIdsToPlan.size} scenes.` : null,
      rebuildAuto && ctx.autoDayIds.length ? `Replace ${ctx.autoDayIds.length} auto-created days.` : null,
      removeEmpty && ctx.emptyDayIds.length ? `Remove ${ctx.emptyDayIds.length} empty days.` : null,
      ctx.numbersFixed ? null : 'Number all days in date order.',
      'The current schedule is saved as a version first, so you can restore it.',
    ].filter(Boolean)
    const ok = await confirm({ title: 'Apply this schedule?', message: parts.join('\n'), confirmLabel: 'Apply' })
    if (!ok) return
    setBusy(true)
    const res = plan
      ? await applyAutoSchedule(projectId, plan, ctx, deleteIds, schedule)
      : await removeEmptyDays(projectId, ctx)
    setBusy(false)
    if (!res.success) {
      notify(res.error || 'Could not apply the schedule', 'error')
      onApplied()
      return
    }
    notify(plan ? `Scheduled ${sceneIdsToPlan.size} scenes over ${plan.days.length} days. A backup version was saved.` : 'Empty days removed. A backup version was saved.', 'success')
    onApplied()
    onClose()
  }

  const nothingToDo = ctx && !plan && !(removeEmpty && ctx.emptyDayIds.length)

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-schedule-title"
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-card/60">
          <div className="min-w-0">
            <h2 id="auto-schedule-title" className="text-base font-semibold text-foreground flex items-center gap-2">
              <Wand2 className="size-4 text-amber-700 dark:text-amber-400" />
              Smart Auto-Schedule
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Groups scenes by location and day/night, fills each day by pages and hours, keeps cast together, and respects
              availability and &quot;shoot after&quot; rules. Nothing changes until you apply.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close (Esc)"
            title="Close (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Options */}
          <div className="px-5 py-4 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Start from</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartInput(e.target.value || null)}
                className="w-full h-9 px-2 rounded-md border border-border bg-background text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Pages per day</span>
              <input
                type="number"
                min={1}
                max={15}
                step={0.5}
                value={pagesPerDay}
                onChange={(e) => setPagesPerDay(Math.min(15, Math.max(1, Number(e.target.value) || 5)))}
                className="w-full h-9 px-2 rounded-md border border-border bg-background text-foreground"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Location moves per day (max)</span>
              <select
                value={maxMoves}
                onChange={(e) => setMaxMoves(Number(e.target.value))}
                className="w-full h-9 px-2 rounded-md border border-border bg-background text-foreground"
              >
                <option value={0}>0 — one location a day</option>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Days off</span>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((w, i) => {
                  const off = daysOff.includes(i)
                  return (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={off}
                      onClick={() => setDaysOff(off ? daysOff.filter((d) => d !== i) : daysOff.length < 6 ? [...daysOff, i] : daysOff)}
                      className={`px-1.5 h-7 rounded-md text-[11px] font-medium border cursor-pointer ${
                        off
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-300'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>
            </div>

            {ctx && (ctx.autoDayIds.length > 0 || ctx.emptyDayIds.length > 0) && (
              <div className="col-span-2 md:col-span-4 flex flex-col sm:flex-row gap-2 sm:gap-6">
                {ctx.autoDayIds.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rebuildAuto} onChange={(e) => setRebuildAuto(e.target.checked)} />
                    <span>
                      Also re-plan the <strong>{ctx.autoDayIds.length}</strong> days created by Auto-Group
                      <span className="text-muted-foreground"> (days you built by hand stay as they are)</span>
                    </span>
                  </label>
                )}
                {ctx.emptyDayIds.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={removeEmpty} onChange={(e) => setRemoveEmpty(e.target.checked)} />
                    <span className="flex items-center gap-1">
                      <Trash2 className="size-3.5 text-muted-foreground" /> Remove <strong>{ctx.emptyDayIds.length}</strong> empty days
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="px-5 py-4 space-y-4">
            {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}
            {!ctx && !loadError && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin mx-auto mb-2" />
                Reading scenes, availability and settings…
              </div>
            )}

            {ctx && !plan && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CalendarRange className="size-6 mx-auto mb-2" />
                {ctx.emptyDayIds.length && removeEmpty
                  ? 'Every scene is already scheduled. You can still remove the empty days.'
                  : 'Every scene is already scheduled.'}
                {ctx.autoDayIds.length > 0 && !rebuildAuto && ' Tick “re-plan” above to rebuild the auto-created days.'}
              </div>
            )}

            {plan && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: 'Shoot days', value: String(plan.days.length) },
                    { label: 'Pages', value: `${formatEighths(totalEighths)} · ${(totalEighths / 8 / plan.days.length).toFixed(1)}/day` },
                    { label: 'Location moves', value: String(moves) },
                    { label: 'Night days', value: String(nights) },
                    {
                      label: 'Dates',
                      value: `${shortDate(plan.days[0].date)} – ${shortDate(plan.days[plan.days.length - 1].date)}`,
                    },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border border-border bg-card px-3 py-2">
                      <div className="text-[11px] text-muted-foreground">{m.label}</div>
                      <div className="text-sm font-semibold text-foreground">{m.value}</div>
                    </div>
                  ))}
                </div>

                {(conflicts.length > 0 || plan.warnings.length > 0) && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm space-y-1">
                    <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="size-4" />
                      {conflicts.length
                        ? `${conflicts.length} thing${conflicts.length > 1 ? 's' : ''} to check${critical ? ` (${critical} critical)` : ''} — you can fix them on the board after applying`
                        : 'Notes'}
                    </div>
                    <ul className="list-disc pl-5 text-foreground/90 space-y-0.5 max-h-28 overflow-y-auto">
                      {plan.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                      {conflicts.slice(0, 8).map((c) => (
                        <li key={c.id}>{c.title}</li>
                      ))}
                      {conflicts.length > 8 && <li>…and {conflicts.length - 8} more</li>}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-[11px] text-muted-foreground text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Day</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium text-right">Pages</th>
                        <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Est.</th>
                        <th className="px-3 py-2 font-medium">Locations · scenes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {plan.days.map((d, i) => (
                        <tr key={d.date} className="align-top">
                          <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {d.part === 'NIGHT' ? (
                                <Moon className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                              ) : (
                                <Sun className="size-3.5 text-amber-600 dark:text-amber-400" />
                              )}
                              {dayNumbers[i]}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {weekdayOf(d.date)} {shortDate(d.date)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap">{formatEighths(d.eighths)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs whitespace-nowrap hidden sm:table-cell">
                            {(d.minutes / 60).toFixed(1)}h
                          </td>
                          <td className="px-3 py-2 text-xs">
                            <div className="font-medium text-foreground">{d.sets.join(' → ')}</div>
                            <div className="text-muted-foreground">
                              Sc {d.sceneIds.map((id) => scenesById.get(id)?.scene_number).join(', ')}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-card/60">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={busy || !ctx || !!nothingToDo}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
          >
            {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Wand2 className="size-4 mr-1.5" />}
            {plan ? `Apply ${plan.days.length} days` : 'Remove empty days'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
