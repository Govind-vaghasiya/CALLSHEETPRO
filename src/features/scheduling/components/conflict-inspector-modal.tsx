'use client'

import React, { useState } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import type { ScheduleConflict, QuickFixAction } from '../lib/conflict-detector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Wand2,
  CheckCircle2,
  ShieldCheck,
  Clock,
  MapPin,
  Moon,
  Trash2,
} from 'lucide-react'

interface ConflictInspectorModalProps {
  isOpen: boolean
  onClose: () => void
  conflicts: ScheduleConflict[]
  onApplyQuickFix: (fix: QuickFixAction) => void
  /** Open ranked fix suggestions for a conflict */
  onFindFixes?: (conflict: ScheduleConflict) => void
}

export function ConflictInspectorModal({
  isOpen,
  onClose,
  conflicts,
  onApplyQuickFix,
  onFindFixes,
}: ConflictInspectorModalProps) {
  useModalBehavior(isOpen, onClose)
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL')

  if (!isOpen) return null

  const criticalCount = conflicts.filter((c) => c.severity === 'CRITICAL').length
  const warningCount = conflicts.filter((c) => c.severity === 'WARNING').length
  const infoCount = conflicts.filter((c) => c.severity === 'INFO').length

  const filteredConflicts = conflicts.filter((c) => {
    if (filterSeverity === 'ALL') return true
    return c.severity === filterSeverity
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* MODAL HEADER */}
        <div className="p-4 border-b border-border flex items-start justify-between gap-4 bg-card/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-amber-700 dark:text-amber-400" />
              <h2 className="text-base font-mono font-bold text-foreground uppercase tracking-wide">
                Rules Engine — Conflict Inspector
              </h2>
            </div>
            <p className="text-xs font-mono text-muted-foreground">
              Real-time schedule validation for turnaround rules, location moves, and daily over-runs.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* SEVERITY STATS & FILTER TABS */}
        <div className="p-3 border-b border-border bg-card/30 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFilterSeverity('ALL')}
              className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'ALL'
                  ? 'bg-amber-500 border-amber-400 text-zinc-950'
                  : 'bg-card border-border text-subtle-foreground hover:text-foreground'
              }`}
            >
              All ({conflicts.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterSeverity('CRITICAL')}
              className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'CRITICAL'
                  ? 'bg-rose-500 border-rose-400 text-white'
                  : 'bg-card border-border text-rose-700 dark:text-rose-400 hover:bg-rose-500/10'
              }`}
            >
              Critical ({criticalCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterSeverity('WARNING')}
              className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'WARNING'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                  : 'bg-card border-border text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              Warnings ({warningCount})
            </button>

            <button
              type="button"
              onClick={() => setFilterSeverity('INFO')}
              className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                filterSeverity === 'INFO'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300'
                  : 'bg-card border-border text-blue-700 dark:text-blue-400 hover:bg-blue-500/10'
              }`}
            >
              Info ({infoCount})
            </button>
          </div>
        </div>

        {/* CONFLICT LIST */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
          {filteredConflicts.length === 0 ? (
            <div className="p-12 text-center text-faint font-mono text-xs border border-dashed border-border rounded-xl space-y-2">
              <CheckCircle2 className="size-8 mx-auto text-emerald-700 dark:text-emerald-400" />
              <p className="text-sm font-bold text-foreground">No Schedule Conflicts Found!</p>
              <p className="text-muted-foreground">
                Your production schedule satisfies SAG-AFTRA 12h turnaround rules and daily workload limits.
              </p>
            </div>
          ) : (
            filteredConflicts.map((c) => {
              const isCritical = c.severity === 'CRITICAL'
              const isWarning = c.severity === 'WARNING'

              return (
                <div
                  key={c.id}
                  className={`p-3.5 rounded-xl border space-y-2 transition-all ${
                    isCritical
                      ? 'bg-rose-950/30 border-rose-800/80 text-rose-100 shadow-rose-950/20'
                      : isWarning
                      ? 'bg-amber-950/30 border-amber-800/80 text-amber-100 shadow-amber-950/20'
                      : 'bg-blue-950/30 border-blue-800/80 text-blue-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {isCritical ? (
                        <AlertCircle className="size-4 text-rose-700 dark:text-rose-400 shrink-0" />
                      ) : isWarning ? (
                        <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400 shrink-0" />
                      ) : (
                        <Info className="size-4 text-blue-700 dark:text-blue-400 shrink-0" />
                      )}

                      <span className="font-mono text-xs font-bold tracking-wide">
                        {c.title}
                      </span>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[9px] font-mono shrink-0 uppercase ${
                        isCritical
                          ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300'
                          : isWarning
                          ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                          : 'bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {c.severity}
                    </Badge>
                  </div>

                  <p className="text-xs font-mono text-subtle-foreground pl-6 leading-relaxed">
                    {c.description}
                  </p>

                  {/* QUICK FIX ACTION BUTTON */}
                  {(c.quickFix || (onFindFixes && c.severity !== 'INFO')) && (
                    <div className="pt-1 pl-6 flex justify-end gap-2">
                      {onFindFixes && c.severity !== 'INFO' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onFindFixes(c)}
                          className="h-7 text-[11px] font-semibold cursor-pointer"
                        >
                          Find fixes
                        </Button>
                      )}
                      {c.quickFix && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          onApplyQuickFix(c.quickFix!)
                        }}
                        className={`h-7 text-[11px] font-mono font-bold cursor-pointer transition-colors shadow-sm ${
                          c.quickFix.actionType === 'DELETE_DAY'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                        }`}
                      >
                        <Wand2 className="size-3 mr-1" />
                        <span>{c.quickFix.label}</span>
                      </Button>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 border-t border-border bg-card/60 flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>
            {conflicts.length} total schedule checks evaluated
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-border text-subtle-foreground hover:text-foreground text-xs font-mono h-8 cursor-pointer"
          >
            Close Inspector
          </Button>
        </div>
      </div>
    </div>
  )
}
