'use client'

import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRightLeft, CalendarClock, Clock, Inbox, ListOrdered, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { useFeedback } from '@/components/ui/feedback-provider'
import type { ProjectScheduleData } from '../actions'
import type { ScheduleConflict } from '../lib/conflict-detector'
import type { ScheduleConstraints } from '../lib/availability-conflicts'
import { freeMinutes, suggestFill, suggestFixes, type Suggestion, type SuggestionKind } from '../lib/suggestions'
import { applyPlan } from '../lib/apply-plan'
import { timelineForDay } from '../lib/availability-conflicts'

export type FixRequest = { kind: 'conflict'; conflict: ScheduleConflict } | { kind: 'fill'; dayId: string }

interface ScheduleFixModalProps {
  request: FixRequest | null
  onClose: () => void
  projectId: string
  schedule: ProjectScheduleData | null
  constraints: ScheduleConstraints
  currency?: string
  onApplied: () => void
}

const KIND: Record<SuggestionKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  REORDER: { label: 'Reorder the day', icon: ListOrdered },
  MOVE_DAY: { label: 'Move to another day', icon: ArrowRightLeft },
  FILL: { label: 'Use the free time', icon: Sparkles },
  TO_POOL: { label: 'Unschedule', icon: Inbox },
}

/** Ranked, pre-checked fixes for a conflict — or scenes to fill free time — with one-click apply. */
export function ScheduleFixModal({
  request,
  onClose,
  projectId,
  schedule,
  constraints,
  currency = 'USD',
  onApplied,
}: ScheduleFixModalProps) {
  const isOpen = request !== null
  const closeRef = useModalBehavior(isOpen, onClose)
  const { confirm, notify } = useFeedback()
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const fillDay = request?.kind === 'fill' ? schedule?.shootDays.find((d) => d.id === request.dayId) : undefined
  const defaultMinutes = useMemo(
    () => (fillDay ? Math.max(15, freeMinutes(timelineForDay(fillDay, constraints.settings))) : 60),
    [fillDay, constraints.settings]
  )
  const [minutesInput, setMinutesInput] = useState<number | null>(null)
  const minutes = minutesInput ?? defaultMinutes

  const suggestions: Suggestion[] = useMemo(() => {
    if (!request || !schedule) return []
    return request.kind === 'conflict'
      ? suggestFixes(schedule, constraints, request.conflict, currency)
      : suggestFill(schedule, constraints, request.dayId, minutes, currency)
  }, [request, schedule, constraints, currency, minutes])

  if (!isOpen || !schedule || typeof document === 'undefined') return null

  const handleApply = async (s: Suggestion) => {
    const ok = await confirm({
      title: 'Apply this change?',
      message: `${s.title}\n\nThe current schedule is saved as a version first, so you can restore it from the version menu.`,
      confirmLabel: 'Apply',
    })
    if (!ok) return
    setApplyingId(s.id)
    const res = await applyPlan(projectId, schedule, s.ops, s.title)
    setApplyingId(null)
    if (!res.success) {
      notify(res.error || 'Could not apply the change', 'error')
      return
    }
    notify('Schedule updated. A backup version was saved.', 'success')
    onApplied()
    onClose()
  }

  const money = (n: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fix-title"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-card/60">
          <div className="min-w-0">
            <h2 id="fix-title" className="text-base font-semibold text-foreground">
              {request.kind === 'conflict' ? 'Ways to fix this' : `Use free time on Day ${fillDay?.day_number ?? ''}`}
            </h2>
            {request.kind === 'conflict' ? (
              <p className="text-sm text-muted-foreground mt-0.5">
                <span className="font-medium text-foreground">{request.conflict.title}.</span> {request.conflict.description}
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <label htmlFor="fill-minutes">Free time</label>
                <input
                  id="fill-minutes"
                  type="number"
                  min={10}
                  step={5}
                  value={minutes}
                  onChange={(e) => setMinutesInput(Math.max(10, Number(e.target.value) || 10))}
                  className="w-20 h-8 px-2 rounded-md border border-border bg-background text-foreground"
                />
                <span>minutes — scenes from later days or the pool that can be shot now</span>
              </div>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close (Esc)"
            title="Close (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {suggestions.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-1">
              <CalendarClock className="size-6 mx-auto" />
              <p>
                {request.kind === 'conflict'
                  ? 'No change fixes this without creating another problem. Try adjusting scene minutes, the call time, or the availability window.'
                  : 'No scene fits this time with everyone available. Try more minutes, or tag the breakdown more fully so more scenes can be checked.'}
              </p>
            </div>
          )}
          {suggestions.map((s, i) => {
            const K = KIND[s.kind]
            return (
              <div
                key={s.id}
                className={`rounded-xl border p-4 space-y-2 ${i === 0 ? 'border-amber-500/50 bg-amber-500/5' : 'border-border bg-card'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <K.icon className="size-3.5" />
                      {K.label}
                      {i === 0 && <span className="ml-1 px-1.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">Best option</span>}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleApply(s)}
                    disabled={applyingId !== null}
                    className="shrink-0 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
                  >
                    {applyingId === s.id ? 'Applying…' : 'Apply'}
                  </Button>
                </div>
                <ul className="space-y-0.5 text-sm text-muted-foreground list-disc pl-5">
                  {s.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {s.impact.fixes > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                      Fixes {s.impact.fixes} issue{s.impact.fixes === 1 ? '' : 's'}
                    </span>
                  )}
                  {s.impact.paidDaysSaved > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                      −{s.impact.paidDaysSaved} paid day{s.impact.paidDaysSaved === 1 ? '' : 's'}
                      {s.impact.costSaved > 0 ? ` · ${money(s.impact.costSaved)}` : ''}
                    </span>
                  )}
                  {s.impact.companyMovesDelta !== 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        s.impact.companyMovesDelta < 0
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {s.impact.companyMovesDelta > 0 ? '+' : ''}
                      {s.impact.companyMovesDelta} company move{Math.abs(s.impact.companyMovesDelta) === 1 ? '' : 's'}
                    </span>
                  )}
                  {s.impact.newIssues.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-800 dark:text-red-300" title={s.impact.newIssues.join('\n')}>
                      Creates {s.impact.newIssues.length} new issue{s.impact.newIssues.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">
          Every option was checked against availability, location hours, fixed start times, continuity, and turnaround. The
          AD confirms before anything changes.
        </div>
      </div>
    </div>,
    document.body
  )
}
