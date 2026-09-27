'use client'

import React, { useState } from 'react'
import { SceneDetailModal } from '@/features/scenes/components/scene-detail-modal'
import { getStripColorClasses } from '@/features/scheduling/lib/strip-colors'
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Clock,
  Film,
  Zap,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Share2,
  ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ProductionMetrics, DailyPacingData } from '../types'

interface AnalyticsDashboardCardProps {
  metrics: ProductionMetrics
  pacingHistory?: DailyPacingData[]
  onOpenGuestShare?: () => void
}

export function AnalyticsDashboardCard({
  metrics,
  pacingHistory = [],
  onOpenGuestShare,
}: AnalyticsDashboardCardProps) {
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [detailSceneId, setDetailSceneId] = useState<string | null>(null)
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: metrics.currency,
    maximumFractionDigits: 0,
  })
  const paceDelta =
    metrics.avgPagesPerDay != null && metrics.targetPagesPerDay != null
      ? Math.round((metrics.avgPagesPerDay - metrics.targetPagesPerDay) * 10) / 10
      : null

  return (
    <Card className="border-border bg-card/60 shadow-xl">
      <CardHeader className="border-b border-border/80 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 text-xs font-mono uppercase tracking-wider font-semibold">
            <BarChart3 className="size-4" /> Executive Production Intelligence
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenGuestShare}
            className="border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:text-foreground text-xs h-8 gap-1.5 cursor-pointer"
          >
            <Share2 className="size-3.5" />
            <span>Share Guest Link</span>
          </Button>
        </div>
        <CardTitle className="text-lg text-foreground">Production Analytics & Shooting Velocity</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Page progress from shoot days marked Completed, scheduling coverage, and the budget estimate from Cast & Crew rates.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Script Completion */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Film className="size-3.5 text-indigo-700 dark:text-indigo-400" /> Script Pages Shot
              </span>
              <span className="font-mono text-indigo-700 dark:text-indigo-400 font-bold">{metrics.completionPercentage}%</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground tracking-tight">
                {metrics.pagesShotCompleted}
              </span>
              <span className="text-xs font-mono text-muted-foreground">/ {metrics.totalScriptPages} pages</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-card overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${metrics.completionPercentage}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground font-mono pt-1">
              {metrics.pagesRemaining} pages remaining · {metrics.shootDaysCompleted} of {metrics.totalShootDays} days completed.
            </p>
          </div>

          {/* Shooting Pacing */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <TrendingUp className="size-3.5 text-emerald-700 dark:text-emerald-400" /> Daily Page Rate
              </span>
              {paceDelta != null && (
                <span className={`font-mono font-bold ${paceDelta >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {paceDelta >= 0 ? '+' : ''}
                  {paceDelta} vs plan
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground tracking-tight">{metrics.avgPagesPerDay ?? '—'}</span>
              <span className="text-xs font-mono text-muted-foreground">pages / day</span>
            </div>
            <div className="text-[11px] text-muted-foreground font-mono pt-1">
              {metrics.avgPagesPerDay == null
                ? 'Mark shoot days Completed to track pace.'
                : `Planned: ${metrics.targetPagesPerDay ?? '—'} pgs/day`}
            </div>
          </div>

          {/* Scheduling coverage */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="size-3.5 text-amber-700 dark:text-amber-400" /> Scenes Scheduled
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground tracking-tight">{metrics.scheduledScenes}</span>
              <span className="text-xs font-mono text-muted-foreground">/ {metrics.totalScenes} scenes</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono pt-1">
              {metrics.totalScenes - metrics.scheduledScenes} still in the unscheduled pool.
            </p>
          </div>

          {/* Budget estimate */}
          <div className="p-4 rounded-xl bg-background border border-border space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <DollarSign className="size-3.5 text-emerald-700 dark:text-emerald-400" /> Estimated Budget
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground tracking-tight">{money.format(metrics.estimatedBudget)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono pt-1">
              From rates on {metrics.pricedResources} Cast &amp; Crew entries and budget line items. Actual spend is not tracked yet.
            </p>
          </div>
        </div>

        {/* Daily Pacing Timeline Table */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-subtle-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="size-3.5 text-indigo-700 dark:text-indigo-400" /> Daily Shoot Log — click a day to see its scenes
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {metrics.shootDaysCompleted} of {metrics.totalShootDays} days completed
            </span>
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-background">
            <table className="w-full text-left text-xs">
              <thead className="bg-card/80 border-b border-border font-mono text-muted-foreground uppercase text-[10px]">
                <tr>
                  <th className="p-3">Shoot Day</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Scheduled Pages</th>
                  <th className="p-3 text-right">Scenes</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-subtle-foreground font-mono">
                {pacingHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No shoot days yet. Build the schedule to see the shoot log.
                    </td>
                  </tr>
                )}
                {pacingHistory.map((day) => {
                  const isOpen = openDayId === day.dayId
                  return (
                    <React.Fragment key={day.dayId}>
                      <tr
                        className="hover:bg-card/40 cursor-pointer"
                        onClick={() => setOpenDayId(isOpen ? null : day.dayId)}
                        aria-expanded={isOpen}
                        title={isOpen ? 'Hide scenes' : 'Show scenes'}
                      >
                        <td className="p-3 font-bold text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <ChevronRight className={`size-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            Day {day.shootDay}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{day.date}</td>
                        <td className="p-3 text-right">{day.scheduledPages.toFixed(1)} pgs</td>
                        <td className="p-3 text-right text-subtle-foreground">{day.sceneCount}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] ${
                              day.status === 'COMPLETED'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {day.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/30">
                          <td colSpan={5} className="p-3">
                            {day.scenes.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No scenes on this day.</p>
                            ) : (
                              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {day.scenes.map((sc) => (
                                  <li key={sc.id}>
                                    <button
                                      type="button"
                                      onClick={() => setDetailSceneId(sc.id)}
                                      className="w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg border border-border bg-card hover:border-amber-500/50 transition-colors cursor-pointer"
                                      title="Open scene details"
                                    >
                                      <span
                                        className={`px-1.5 py-0.5 rounded border font-black text-[11px] shrink-0 ${
                                          getStripColorClasses(sc.intExt, sc.timeOfDay).container
                                        }`}
                                      >
                                        {sc.sceneNumber}
                                      </span>
                                      <span className="truncate text-xs text-foreground uppercase">{sc.heading || 'Untitled scene'}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
      <SceneDetailModal sceneId={detailSceneId} onClose={() => setDetailSceneId(null)} />
    </Card>
  )
}
