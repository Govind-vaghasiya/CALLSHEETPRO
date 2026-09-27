import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProjectById } from '@/features/projects/actions'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  FileCode2,
  Users,
  FileText,
  ShieldCheck,
  ArrowRight,
  Sliders
} from 'lucide-react'
import { detectScheduleConflicts } from '@/features/scheduling/lib/conflict-detector'
import { loadSchedule } from '@/features/scheduling/lib/load-schedule'

import { getProductionAnalyticsAction } from '@/features/analytics/actions'
import { ProjectAnalyticsSection } from '@/features/analytics/components/project-analytics-section'

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  const { metrics, pacingHistory } = await getProductionAnalyticsAction(id)

  const settings = project.project_settings || {
    default_call_time: '07:00',
    min_turnaround_hours: 12,
    max_shooting_hours: 10,
    currency: 'USD',
  }

  const supabase = await createClient()
  const [{ count: resourceCount }, { count: sceneCount }] = await Promise.all([
    supabase.from('resources').select('*', { count: 'exact', head: true }).eq('project_id', id),
    supabase.from('scenes').select('*', { count: 'exact', head: true }).eq('project_id', id),
  ])

  // Real rules check: run the schedule conflict engine over the saved schedule
  const { shootDays: scheduleDays } = await loadSchedule(supabase, id)
  const days = scheduleDays
  const conflicts = detectScheduleConflicts(scheduleDays)
  const criticalCount = conflicts.filter((c) => c.severity === 'CRITICAL').length
  const warningCount = conflicts.filter((c) => c.severity === 'WARNING').length

  return (
    <div className="space-y-8 w-full">
      {/* Quick Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Shooting Days
            </CardTitle>
            <Calendar className="size-4 text-amber-700 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.totalShootDays}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {metrics.shootDaysCompleted} completed · planned in stripboard
            </p>
          </CardContent>
        </Card>

        <Link href={`/projects/${id}/scripts`} className="block group">
          <Card className="border-border bg-card/50 hover:border-border-strong transition-all h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 font-medium transition-colors">
                Scenes
              </CardTitle>
              <FileCode2 className="size-4 text-amber-700 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                {sceneCount || 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Ready for breakdown →</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/projects/${id}/resources`} className="block group">
          <Card className="border-border bg-card/50 hover:border-border-strong transition-all h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-mono uppercase text-muted-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 font-medium transition-colors">
                Resources & Cast
              </CardTitle>
              <Users className="size-4 text-amber-700 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                {resourceCount || 0}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Personnel & assets attached →</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Rules Compliance
            </CardTitle>
            <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                criticalCount > 0
                  ? 'text-red-700 dark:text-red-400'
                  : warningCount > 0
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {days?.length ? (criticalCount + warningCount === 0 ? 'Clear' : `${criticalCount + warningCount} issues`) : '—'}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {days?.length
                ? `${criticalCount} critical · ${warningCount} warnings (turnaround, hours, moves)`
                : 'No schedule yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics & Shooting Telemetry */}
      <ProjectAnalyticsSection
        projectId={id}
        projectName={project.name}
        metrics={metrics}
        pacingHistory={pacingHistory}
      />

      {/* Production Pipeline Workflows */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          Production Pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-border bg-card/40 hover:border-border-strong transition-colors">
            <CardHeader className="pb-3">
              <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-2">
                <FileCode2 className="size-4" />
              </div>
              <CardTitle className="text-base text-foreground">
                1. Upload & Break Down Script
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Import PDF or Final Draft (.fdx) screenplay. The system detects scenes, characters, props, and locations automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/projects/${id}/scripts`}>
                <Button variant="outline" className="w-full justify-between text-xs border-border text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-muted/60">
                  <span>Open Script Breakdown</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/40 hover:border-border-strong transition-colors">
            <CardHeader className="pb-3">
              <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-2">
                <Calendar className="size-4" />
              </div>
              <CardTitle className="text-base text-foreground">
                2. Build Stripboard Schedule
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Drag-and-drop scene strips onto shoot days. Validate 12-hour rest periods, meal penalties, and generate Day-Out-of-Days reports.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/projects/${id}/schedule`}>
                <Button variant="outline" className="w-full justify-between text-xs border-border text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-muted/60">
                  <span>Open Stripboard Scheduler</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/40 hover:border-border-strong transition-colors">
            <CardHeader className="pb-3">
              <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-2">
                <Users className="size-4" />
              </div>
              <CardTitle className="text-base text-foreground">
                3. Cast, Crew & Location Rates
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Manage all production resources, daily/weekly pay rates, contact details, and precise availability time windows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/projects/${id}/resources`}>
                <Button variant="outline" className="w-full justify-between text-xs border-border text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-muted/60">
                  <span>Manage Resources</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/40 hover:border-border-strong transition-colors">
            <CardHeader className="pb-3">
              <div className="size-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-2">
                <FileText className="size-4" />
              </div>
              <CardTitle className="text-base text-foreground">
                4. One-Click Call Sheets
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Generate production-ready industry call sheets formatted with crew call times, weather reports, nearest emergency hospital, and scene list.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/projects/${id}/callsheets`}>
                <Button variant="outline" className="w-full justify-between text-xs border-border text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-muted/60">
                  <span>Generate Call Sheet</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Shooting Day Rules Summary */}
      <Card className="border-border bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold text-foreground">
              Shooting Day Rules & Union Defaults
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configured rules enforced by the CallSheetPro conflict engine.
            </CardDescription>
          </div>
          <Link href={`/projects/${id}/settings`}>
            <Button variant="outline" size="sm" className="text-xs border-border text-subtle-foreground hover:text-foreground">
              <Sliders className="size-3.5 mr-1.5" />
              Edit Rules
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-background/60 border border-border/80">
              <span className="text-muted-foreground block text-[10px] uppercase">Default Call Time</span>
              <span className="text-foreground font-bold text-sm">{settings.default_call_time}</span>
            </div>
            <div className="p-3 rounded-lg bg-background/60 border border-border/80">
              <span className="text-muted-foreground block text-[10px] uppercase">Min Rest Turnaround</span>
              <span className="text-foreground font-bold text-sm">{settings.min_turnaround_hours} Hours</span>
            </div>
            <div className="p-3 rounded-lg bg-background/60 border border-border/80">
              <span className="text-muted-foreground block text-[10px] uppercase">Max Shooting Hours</span>
              <span className="text-foreground font-bold text-sm">{settings.max_shooting_hours} Hours</span>
            </div>
            <div className="p-3 rounded-lg bg-background/60 border border-border/80">
              <span className="text-muted-foreground block text-[10px] uppercase">Currency</span>
              <span className="text-foreground font-bold text-sm">{settings.currency}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
