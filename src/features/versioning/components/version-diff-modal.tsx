'use client'

import React, { useState, useMemo } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import type { ScheduleVersionSnapshot } from '../types'
import { compareScheduleVersions } from '../actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GitCompare,
  ArrowRight,
  Plus,
  Minus,
  MoveRight,
  Clock,
  CheckCircle2,
  X,
  FileText,
} from 'lucide-react'

interface VersionDiffModalProps {
  isOpen: boolean
  onClose: () => void
  versions: ScheduleVersionSnapshot[]
}

export function VersionDiffModal({
  isOpen,
  onClose,
  versions,
}: VersionDiffModalProps) {
  useModalBehavior(isOpen, onClose)
  const [versionAId, setVersionAId] = useState<string>(versions[1]?.id || versions[0]?.id || '')
  const [versionBId, setVersionBId] = useState<string>(versions[0]?.id || '')

  if (!isOpen) return null

  const versionA = versions.find((v) => v.id === versionAId) || versions[1] || versions[0]
  const versionB = versions.find((v) => v.id === versionBId) || versions[0]

  const diffResult = useMemo(() => {
    if (!versionA || !versionB) return null
    return compareScheduleVersions(versionA, versionB)
  }, [versionA, versionB])

  const totalChanges = diffResult
    ? diffResult.addedDayNumbers.length +
      diffResult.removedDayNumbers.length +
      diffResult.movedScenes.length +
      diffResult.timeShifts.length
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* MODAL HEADER */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-2 font-mono font-bold text-foreground text-sm">
            <GitCompare className="size-4 text-amber-700 dark:text-amber-400" />
            <span>Schedule Version Diff Comparison</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* VERSION SELECTORS */}
        <div className="p-4 border-b border-border bg-card/30 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div className="space-y-1 font-mono text-xs">
            <label className="text-[10px] text-muted-foreground font-bold uppercase">
              Base Version (Original)
            </label>
            <select
              value={versionAId}
              onChange={(e) => setVersionAId(e.target.value)}
              className="w-full h-8 px-2 text-xs font-mono rounded-lg bg-card border border-border text-foreground outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versionName} ({new Date(v.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 font-mono text-xs">
            <label className="text-[10px] text-muted-foreground font-bold uppercase">
              Target Version (Compared)
            </label>
            <select
              value={versionBId}
              onChange={(e) => setVersionBId(e.target.value)}
              className="w-full h-8 px-2 text-xs font-mono rounded-lg bg-card border border-border text-amber-700 dark:text-amber-400 font-bold outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versionName} ({new Date(v.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* DIFF RESULTS CONTAINER */}
        <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar font-mono text-xs">
          {!diffResult || totalChanges === 0 ? (
            <div className="p-12 text-center text-faint text-xs border border-dashed border-border rounded-xl space-y-2">
              <CheckCircle2 className="size-8 mx-auto text-emerald-700 dark:text-emerald-400" />
              <p className="text-sm font-bold text-foreground">No Schedule Differences Found!</p>
              <p className="text-muted-foreground">
                Both schedule versions have identical shoot day assignments and scene layouts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Added Shoot Days */}
              {diffResult.addedDayNumbers.map((dayNum) => (
                <div
                  key={`add-day-${dayNum}`}
                  className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/80 text-emerald-800 dark:text-emerald-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Plus className="size-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Added Shoot Day {dayNum}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-300">
                    ADDED DAY
                  </Badge>
                </div>
              ))}

              {/* Removed Shoot Days */}
              {diffResult.removedDayNumbers.map((dayNum) => (
                <div
                  key={`remove-day-${dayNum}`}
                  className="p-3 rounded-xl bg-rose-950/30 border border-rose-800/80 text-rose-800 dark:text-rose-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 font-bold">
                    <Minus className="size-4 text-rose-700 dark:text-rose-400" />
                    <span>Removed Shoot Day {dayNum}</span>
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-300">
                    REMOVED DAY
                  </Badge>
                </div>
              ))}

              {/* Moved Scenes */}
              {diffResult.movedScenes.map((item) => (
                <div
                  key={`move-scene-${item.sceneId}`}
                  className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/80 text-amber-100 flex items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-foreground">
                      <FileText className="size-3.5 text-amber-700 dark:text-amber-400" />
                      <span>Scene #{item.sceneNumber} — {item.heading}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                      <span>Day {item.fromDayNumber}</span>
                      <MoveRight className="size-3 text-amber-700 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300 font-bold">Day {item.toDayNumber}</span>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[9px] bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300 shrink-0">
                    MOVED SCENE
                  </Badge>
                </div>
              ))}

              {/* Time Shift Diffs */}
              {diffResult.timeShifts.map((shift) => (
                <div
                  key={`time-shift-${shift.dayNumber}`}
                  className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/80 text-blue-100 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-bold text-foreground">
                      <Clock className="size-3.5 text-blue-700 dark:text-blue-400" />
                      <span>Shoot Day {shift.dayNumber} Call Time Shift</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span>{shift.oldCallTime}</span>
                      <ArrowRight className="size-3 text-blue-700 dark:text-blue-400" />
                      <span className="text-blue-700 dark:text-blue-300 font-bold">{shift.newCallTime}</span>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[9px] bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-300">
                    TIME SHIFT
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 border-t border-border bg-card/60 flex items-center justify-between font-mono text-xs text-muted-foreground">
          <span>{totalChanges} total differences detected</span>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-border text-subtle-foreground hover:text-foreground text-xs font-mono h-8 cursor-pointer"
          >
            Close Diff Tool
          </Button>
        </div>
      </div>
    </div>
  )
}
