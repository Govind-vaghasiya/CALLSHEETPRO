'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Activity, ShieldCheck, Clock, MapPin, Users } from 'lucide-react'
import type { ScheduleHealthScore } from '../types'

interface ScheduleHealthCardProps {
  score: ScheduleHealthScore
}

export function ScheduleHealthCard({ score }: ScheduleHealthCardProps) {
  const getScoreColor = (val: number) => {
    if (val >= 85) return 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    if (val >= 65) return 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
    return 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
  }

  const getScoreBadge = (val: number) => {
    if (val >= 85) return { label: 'OPTIMAL SCHEDULE', variant: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' }
    if (val >= 65) return { label: 'FAIR / MINOR ISSUES', variant: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30' }
    return { label: 'AT-RISK / HIGH CONFLICTS', variant: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30' }
  }

  const badgeInfo = getScoreBadge(score.overallScore)

  return (
    <div className="bg-background border border-border/80 p-5 rounded-2xl space-y-5 shadow-xl">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-emerald-700 dark:text-emerald-400" />
          <h3 className="text-base font-bold text-foreground tracking-tight">
            Schedule Health Diagnostic
          </h3>
        </div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeInfo.variant}`}>
          {badgeInfo.label}
        </span>
      </div>

      {/* Main Score Display & Sub-Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
        {/* Large Score Dial */}
        <div className="md:col-span-2 flex flex-col items-center justify-center p-4 bg-card/60 border border-border/60 rounded-xl text-center">
          <div className={`text-4xl font-extrabold tracking-tight font-mono ${getScoreColor(score.overallScore).split(' ')[0]}`}>
            {score.overallScore}
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono mt-1">Overall AI Health Rating</span>
        </div>

        {/* Sub-metrics Progress Bars */}
        <div className="md:col-span-3 space-y-3">
          {/* Turnaround Safety */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-subtle-foreground flex items-center gap-1.5 font-medium">
                <Clock className="size-3.5 text-emerald-700 dark:text-emerald-400" /> Turnaround Rest Safety
              </span>
              <span className="font-mono text-muted-foreground">{score.turnaroundSafetyScore}%</span>
            </div>
            <div className="w-full h-2 bg-card rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${score.turnaroundSafetyScore}%` }}
              />
            </div>
          </div>

          {/* Workload Balance */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-subtle-foreground flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-3.5 text-amber-700 dark:text-amber-400" /> Workload & Hours Limit
              </span>
              <span className="font-mono text-muted-foreground">{score.workloadBalanceScore}%</span>
            </div>
            <div className="w-full h-2 bg-card rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${score.workloadBalanceScore}%` }}
              />
            </div>
          </div>

          {/* Location Efficiency */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-subtle-foreground flex items-center gap-1.5 font-medium">
                <MapPin className="size-3.5 text-sky-700 dark:text-sky-400" /> Location Move Efficiency
              </span>
              <span className="font-mono text-muted-foreground">{score.locationEfficiencyScore}%</span>
            </div>
            <div className="w-full h-2 bg-card rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-sky-500 transition-all duration-500"
                style={{ width: `${score.locationEfficiencyScore}%` }}
              />
            </div>
          </div>

          {/* Cast Hold Efficiency */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-subtle-foreground flex items-center gap-1.5 font-medium">
                <Users className="size-3.5 text-purple-700 dark:text-purple-400" /> Cast Hold Ratio
              </span>
              <span className="font-mono text-muted-foreground">{score.castHoldEfficiencyScore}%</span>
            </div>
            <div className="w-full h-2 bg-card rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-purple-500 transition-all duration-500"
                style={{ width: `${score.castHoldEfficiencyScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
