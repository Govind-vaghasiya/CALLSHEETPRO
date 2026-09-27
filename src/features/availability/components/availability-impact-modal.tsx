'use client'

import React, { useState, useEffect } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Zap, Film, Calendar, X, Check, ShieldAlert } from 'lucide-react'
import type { AvailabilityImpactReport } from '../types'
import { applyAvailabilityResolutionAction, calculateAvailabilityImpactAction } from '../actions'

interface AvailabilityImpactModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  resourceId: string
  startDate: string
  endDate: string
  startTime?: string | null
  endTime?: string | null
}

export function AvailabilityImpactModal({
  isOpen,
  onClose,
  projectId,
  resourceId,
  startDate,
  endDate,
  startTime = null,
  endTime = null,
}: AvailabilityImpactModalProps) {
  useModalBehavior(isOpen, onClose)
  const [report, setReport] = useState<AvailabilityImpactReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)


  useEffect(() => {
    if (isOpen && resourceId && startDate && endDate) {
      loadImpact()
    }
  }, [isOpen, projectId, resourceId, startDate, endDate, startTime, endTime])

  async function loadImpact() {
    setIsLoading(true)
    try {
      const data = await calculateAvailabilityImpactAction(projectId, resourceId, startDate, endDate, startTime, endTime)
      setReport(data)
    } catch (err) {
      console.error('Impact calculation error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function applyResolution(res: AvailabilityImpactReport['suggestedResolutions'][number]) {
    setApplyingId(res.id)
    const result = await applyAvailabilityResolutionAction(
      projectId,
      resourceId,
      startDate,
      endDate,
      res.actionType,
      startTime,
      endTime
    )
    setApplyingId(null)
    setMessage(result.success || result.error || null)
    if (result.success) await loadImpact()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-2xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-card/60">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-rose-700 dark:text-rose-400" />
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                Availability Impact & Blast Radius Inspector
              </h3>
              <p className="text-xs text-muted-foreground">
                Evaluating schedule impact for resource blackout windows.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !report ? (
            <div className="py-20 text-center space-y-3">
              <Zap className="size-8 text-rose-700 dark:text-rose-400 animate-bounce mx-auto" />
              <p className="text-sm text-subtle-foreground font-medium">Calculating schedule blast radius...</p>
            </div>
          ) : (
            <>
              {/* Resource & Blackout Summary */}
              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-base">{report.resourceName}</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-700 dark:text-rose-300">
                      {report.resourceType}
                    </Badge>
                  </div>
                  <div className="text-xs text-rose-700 dark:text-rose-300 mt-0.5">
                    Blackout Window: <span className="font-mono">{report.startDate}</span> → <span className="font-mono">{report.endDate}</span>
                    {report.timeLabel && <span className="font-mono"> · {report.timeLabel}</span>}
                  </div>
                </div>

                <Badge variant="destructive" className="font-mono text-[10px]">
                  BLACKOUT ACTIVE
                </Badge>
              </div>

              {/* Stat Counter Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-card/80 border border-border p-3 rounded-xl">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Affected Days</span>
                  <span className="text-xl font-bold text-rose-700 dark:text-rose-400">{report.affectedShootDays.length} Days</span>
                </div>
                <div className="bg-card/80 border border-border p-3 rounded-xl">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Impacted Scenes</span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-400">{report.affectedScenes.length} Scenes</span>
                </div>
                <div className="bg-card/80 border border-border p-3 rounded-xl">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Pages Impacted</span>
                  <span className="text-xl font-bold text-foreground">{report.totalPagesImpacted} pgs</span>
                </div>
              </div>

              {/* Impacted Scenes List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-subtle-foreground uppercase tracking-wider block">
                  Impacted Scenes on Scheduled Days
                </span>

                {report.affectedScenes.length === 0 ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                    No scheduled scene needs them during this time.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {report.affectedScenes.map((sc) => (
                      <div
                        key={sc.sceneId}
                        className="p-3 bg-card/60 border border-border rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-sm">SC {sc.sceneNumber}</span>
                          <span className="text-foreground font-semibold">{sc.heading}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono text-right">
                          {sc.plannedSlot && <span className="block text-rose-700 dark:text-rose-400 font-semibold">{sc.plannedSlot}</span>}
                          {sc.locationName}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {report.onCallWarnings.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-subtle-foreground uppercase tracking-wider block">
                    On call, but between scenes
                  </span>
                  {report.onCallWarnings.map((w, i) => (
                    <p key={i} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* 1-Click Resolutions */}
              <div className="space-y-2 pt-2 border-t border-border/80">
                <span className="text-xs font-bold text-subtle-foreground uppercase tracking-wider block">
                  Suggested Resolutions
                </span>
                {message && <p className="text-xs text-muted-foreground">{message}</p>}
                {report.suggestedResolutions.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing to resolve — no scheduled scene needs this resource in that window.</p>
                )}
                <div className="space-y-2">
                  {report.suggestedResolutions.map((res) => (
                    <div
                      key={res.id}
                      className="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="text-foreground font-medium">{res.label}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyResolution(res)}
                        disabled={applyingId !== null}
                        className="border-border-strong text-subtle-foreground hover:text-foreground hover:bg-muted text-[11px]"
                      >
                        {applyingId === res.id ? 'Applying…' : 'Apply Resolution'}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
