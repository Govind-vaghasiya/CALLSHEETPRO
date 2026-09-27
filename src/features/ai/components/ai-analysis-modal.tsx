'use client'

import React, { useState, useEffect } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, AlertTriangle, CheckCircle, Info, X, Lightbulb, RefreshCw } from 'lucide-react'
import type { ScheduleAnalysisReport } from '../types'
import { analyzeScheduleHealthAction } from '../actions'
import { ScheduleHealthCard } from './schedule-health-card'

interface AiAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export function AiAnalysisModal({ isOpen, onClose, projectId }: AiAnalysisModalProps) {
  useModalBehavior(isOpen, onClose)
  const [report, setReport] = useState<ScheduleAnalysisReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadAnalysis()
    }
  }, [isOpen, projectId])

  async function loadAnalysis() {
    setIsLoading(true)
    try {
      const data = await analyzeScheduleHealthAction(projectId)
      setReport(data)
    } catch (err) {
      console.error('AI Schedule Analysis error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-card/60">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                AI Schedule Advisor & Health Diagnostics
              </h3>
              <p className="text-xs text-muted-foreground">
                Automated schedule analysis for turnarounds, company moves, and workload balance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={loadAnalysis}
              variant="outline"
              size="sm"
              disabled={isLoading}
              className="border-border text-subtle-foreground hover:text-foreground hover:bg-card gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Re-analyze</span>
            </Button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading || !report ? (
            <div className="py-20 text-center space-y-3">
              <Sparkles className="size-8 text-emerald-700 dark:text-emerald-400 animate-pulse mx-auto" />
              <p className="text-sm text-subtle-foreground font-medium">Evaluating schedule parameters & union turnaround rules...</p>
            </div>
          ) : (
            <>
              {/* Health Meter Card */}
              <ScheduleHealthCard score={report.healthScore} />

              {/* Summary Metrics Banner */}
              <div className="grid grid-cols-4 gap-3 bg-card/60 border border-border/80 p-3.5 rounded-xl text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Shoot Days</span>
                  <span className="text-base font-bold text-foreground">{report.metricsSummary.totalShootDays}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Total Duration</span>
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">{report.metricsSummary.totalPages}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Avg Hours/Day</span>
                  <span className="text-base font-bold text-foreground">{report.metricsSummary.avgHoursPerDay}h</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono block">Location Moves</span>
                  <span className="text-base font-bold text-sky-700 dark:text-sky-400">{report.metricsSummary.totalLocationMoves}</span>
                </div>
              </div>

              {/* AI Recommendations */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-subtle-foreground text-xs font-bold uppercase tracking-wider">
                  <Lightbulb className="size-4 text-amber-700 dark:text-amber-400" />
                  <span>AI Executive Recommendations</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl space-y-1.5 text-xs text-amber-800 dark:text-amber-200">
                  {report.recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-amber-700 dark:text-amber-400 font-bold">•</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnostic Issues List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-subtle-foreground text-xs font-bold uppercase tracking-wider">
                    <AlertTriangle className="size-4 text-rose-700 dark:text-rose-400" />
                    <span>Diagnostic Warnings & Findings ({report.diagnostics.length})</span>
                  </div>
                </div>

                {report.diagnostics.length === 0 ? (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                    <CheckCircle className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    <span>No schedule diagnostic issues found! Your shoot schedule is fully compliant.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {report.diagnostics.map((diag) => (
                      <div
                        key={diag.id}
                        className={`p-4 rounded-xl border text-xs space-y-1.5 transition-all ${
                          diag.severity === 'CRITICAL'
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                            : diag.severity === 'WARNING'
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200'
                            : 'bg-card/80 border-border text-subtle-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-foreground text-sm">{diag.title}</span>
                          <Badge
                            variant={
                              diag.severity === 'CRITICAL'
                                ? 'destructive'
                                : diag.severity === 'WARNING'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-[9px] font-mono"
                          >
                            {diag.severity}
                          </Badge>
                        </div>
                        <p className="text-subtle-foreground">{diag.description}</p>
                        <div className="flex items-center gap-2 text-[11px] opacity-90 pt-1 font-mono">
                          <span className="font-semibold text-muted-foreground">Fix:</span>
                          <span>{diag.suggestedAction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
