'use client'

import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ArrowRight, CalendarClock, CalendarPlus, FileWarning, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { useFeedback } from '@/components/ui/feedback-provider'
import type { ProjectScheduleData } from '../actions'
import { detectAvailabilityConflicts, type ScheduleConstraints } from '../lib/availability-conflicts'
import {
  dayOffReason,
  planDateChange,
  planInsertDayOff,
  type DatePlan,
  type ProductionCalendar,
} from '../lib/production-calendar'
import { applyDatePlan, numbersFixed, toCalendarDays } from '../lib/production-calendar-run'

export type DateRequest = { kind: 'date'; dayId: string } | { kind: 'dayoff'; dayId: string }

interface DayDateModalProps {
  request: DateRequest
  onClose: () => void
  projectId: string
  schedule: ProjectScheduleData
  calendar: ProductionCalendar
  constraints: ScheduleConstraints
  /** shoot day id → date on its published call sheet */
  publishedSheets: Map<string, string | null>
  onApplied: () => void
}

const fmt = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

/** Change a shoot day's date (push / move only) or insert a day off — previewed before saving. */
export function DayDateModal({ request, onClose, projectId, schedule, calendar, constraints, publishedSheets, onApplied }: DayDateModalProps) {
  const closeRef = useModalBehavior(true, onClose)
  const { notify } = useFeedback()
  const day = schedule.shootDays.find((d) => d.id === request.dayId)
  const [newDate, setNewDate] = useState(day?.shoot_date || '')
  const [mode, setMode] = useState<'PUSH' | 'MOVE'>('PUSH')
  const [busy, setBusy] = useState(false)

  const days = useMemo(() => toCalendarDays(schedule), [schedule])
  const plan: DatePlan = useMemo(() => {
    if (!day) return { moves: [], warnings: [], error: 'Day not found.' }
    return request.kind === 'dayoff'
      ? planInsertDayOff(days, day.id, calendar)
      : planDateChange(days, day.id, newDate, mode, calendar)
  }, [request.kind, day, days, newDate, mode, calendar])

  // Conflicts the change would add (same checks as the stripboard)
  const newConflicts = useMemo(() => {
    if (!plan.moves.length) return []
    const before = new Set(detectAvailabilityConflicts(schedule.shootDays, constraints).conflicts.map((c) => c.id))
    const moved = new Map(plan.moves.map((m) => [m.dayId, m.to]))
    const simulated = schedule.shootDays.map((d) => (moved.has(d.id) ? { ...d, shoot_date: moved.get(d.id)! } : d))
    return detectAvailabilityConflicts(simulated, constraints).conflicts.filter((c) => !before.has(c.id))
  }, [plan, schedule, constraints])

  const staleSheets = plan.moves.filter((m) => publishedSheets.has(m.dayId))
  const keepNumbers = numbersFixed(schedule)

  if (!day || typeof document === 'undefined') return null

  const title =
    request.kind === 'dayoff'
      ? `Inserted a day off after Day ${day.day_number}`
      : mode === 'PUSH'
        ? `Pushed Day ${day.day_number} to ${fmt(newDate)}${plan.moves.length > 1 ? ` (+${plan.moves.length - 1} later days)` : ''}`
        : `Moved Day ${day.day_number} to ${fmt(newDate)}`

  const handleApply = async () => {
    setBusy(true)
    const res = await applyDatePlan(projectId, plan, title, keepNumbers)
    setBusy(false)
    if (!res.success) {
      notify(res.error || 'Could not change the dates', 'error')
      onApplied()
      return
    }
    notify(`${title}. A backup version was saved.`, 'success')
    onApplied()
    onClose()
  }

  const off = request.kind === 'date' && newDate ? dayOffReason(newDate, calendar) : null
  const lastMove = plan.moves[plan.moves.length - 1]
  const shiftLabel =
    plan.shift !== undefined && plan.shift !== 0
      ? `${plan.shift > 0 ? '+' : ''}${plan.shift} working day${Math.abs(plan.shift) === 1 ? '' : 's'}`
      : null

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
        aria-labelledby="day-date-title"
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-card/60">
          <div className="min-w-0">
            <h2 id="day-date-title" className="text-base font-semibold text-foreground flex items-center gap-2">
              {request.kind === 'dayoff' ? (
                <CalendarPlus className="size-4 text-amber-700 dark:text-amber-400" />
              ) : (
                <CalendarClock className="size-4 text-amber-700 dark:text-amber-400" />
              )}
              {request.kind === 'dayoff' ? `Insert a day off after Day ${day.day_number}` : `Change date — Day ${day.day_number}`}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {request.kind === 'dayoff'
                ? `The next shoot day and every day after it move one working day later. ${fmt(day.shoot_date)} stays as it is.`
                : `Currently ${fmt(day.shoot_date)}. Days off and holidays come from the production calendar (Settings).`}
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {request.kind === 'date' && (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">New date</span>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full sm:w-56 h-9 px-2 rounded-md border border-border bg-background text-foreground"
                />
                {off && <span className="block text-xs text-amber-700 dark:text-amber-400">Day off in the calendar: {off}</span>}
              </label>

              <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="How other days behave">
                {[
                  {
                    id: 'PUSH' as const,
                    title: 'Push this and all later days',
                    body: 'Later days slide by the same number of working days. Use for rain days, a late actor, a lost location.',
                  },
                  {
                    id: 'MOVE' as const,
                    title: 'Move only this day',
                    body: 'Other days keep their dates. Use to fine-tune one day into a free date.',
                  },
                ].map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === o.id}
                    onClick={() => setMode(o.id)}
                    className={`text-left rounded-lg border p-3 cursor-pointer transition-colors ${
                      mode === o.id ? 'border-amber-500/60 bg-amber-500/10' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium text-foreground">
                      {o.title}
                      {o.id === 'PUSH' && <span className="ml-1.5 text-[10px] text-muted-foreground">(standard)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{o.body}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Preview */}
          {plan.error ? (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-400">{plan.error}</p>
          ) : plan.moves.length === 0 ? (
            <p className="text-muted-foreground">Pick a different date to see what changes.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="font-medium text-foreground">
                  {plan.moves.length === 1 ? '1 day moves' : `${plan.moves.length} days move`}
                  {shiftLabel && <span className="text-muted-foreground font-normal"> · {shiftLabel}</span>}
                  {lastMove && plan.moves.length > 1 && (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      · last moved day now {fmt(lastMove.to)}
                    </span>
                  )}
                </div>
                <ul className="mt-1.5 space-y-0.5 text-xs font-mono max-h-40 overflow-y-auto">
                  {plan.moves.map((m) => (
                    <li key={m.dayId} className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-14 text-foreground">Day {m.dayNumber}</span>
                      <span>{fmt(m.from)}</span>
                      <ArrowRight className="size-3" />
                      <span className="text-foreground">{fmt(m.to)}</span>
                      {publishedSheets.has(m.dayId) && <FileWarning className="size-3 text-amber-600" aria-label="Published call sheet" />}
                    </li>
                  ))}
                </ul>
                {!keepNumbers && <p className="mt-1.5 text-[11px] text-muted-foreground">Day numbers follow the dates afterwards.</p>}
              </div>

              {(plan.warnings.length > 0 || staleSheets.length > 0 || newConflicts.length > 0) && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="size-4" /> Check before applying
                  </div>
                  <ul className="list-disc pl-5 text-foreground/90 space-y-0.5 text-xs">
                    {plan.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                    {staleSheets.length > 0 && (
                      <li>
                        {staleSheets.length} published call sheet{staleSheets.length > 1 ? 's' : ''} (Day{' '}
                        {staleSheets.map((m) => m.dayNumber).join(', ')}) will show the old date — republish{' '}
                        {staleSheets.length > 1 ? 'them' : 'it'} after this.
                      </li>
                    )}
                    {newConflicts.slice(0, 6).map((c) => (
                      <li key={c.id}>{c.title}</li>
                    ))}
                    {newConflicts.length > 6 && <li>…and {newConflicts.length - 6} more new conflicts</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-border bg-card/60">
          <span className="text-[11px] text-muted-foreground">A backup version is saved first.</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy} className="cursor-pointer">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApply}
              disabled={busy || !!plan.error || plan.moves.length === 0}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
            >
              {busy && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {request.kind === 'dayoff' ? 'Insert day off' : mode === 'PUSH' ? 'Push days' : 'Move day'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

