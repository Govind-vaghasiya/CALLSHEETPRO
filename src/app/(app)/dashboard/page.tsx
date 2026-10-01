import React from 'react'
import { getActiveOrganization } from '@/features/organizations/active-org'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserWithProfile } from '@/features/organizations/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Clapperboard,
  Plus,
  Calendar,
  CalendarDays,
  ListChecks,
  FileCode2,
  FileText,
  Film,
  ArrowRight,
} from 'lucide-react'

export default async function DashboardPage() {
  const user = await getCurrentUserWithProfile()
  const { active } = await getActiveOrganization()
  const activeOrg = active?.organization

  const supabase = await createClient()

  // Fetch projects for this organization
  interface ProjectItem {
    id: string
    name: string
    description: string | null
    project_type: string
    status: string
    created_at: string
  }
  let projects: ProjectItem[] = []
  if (activeOrg?.id) {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', activeOrg.id)
      .order('created_at', { ascending: false })

    projects = data || []
  }

  // Real production numbers for the metrics row
  const projectIds = projects.map((p) => p.id)
  const today = new Date().toISOString().slice(0, 10)
  let shootDayCount = 0
  let sceneCount = 0
  let nextShootDay: { shoot_date: string; day_number: number | null; project_id: string } | null = null
  if (projectIds.length > 0) {
    const [shootDays, scenes, upcoming] = await Promise.all([
      supabase.from('shoot_days').select('id', { count: 'exact', head: true }).in('project_id', projectIds),
      supabase.from('scenes').select('id', { count: 'exact', head: true }).in('project_id', projectIds),
      supabase
        .from('shoot_days')
        .select('shoot_date, day_number, project_id')
        .in('project_id', projectIds)
        .gte('shoot_date', today)
        .order('shoot_date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])
    shootDayCount = shootDays.count ?? 0
    sceneCount = scenes.count ?? 0
    nextShootDay = upcoming.data
  }

  const inProductionCount = projects.filter((p) => p.status === 'PRODUCTION').length
  const nextShootProject = nextShootDay && projects.find((p) => p.id === nextShootDay.project_id)
  const latestProject = projects[0]

  const displayName = user?.profile?.full_name || user?.email?.split('@')[0] || 'Producer'

  const metrics = [
    {
      label: 'Productions',
      value: projects.length,
      hint: inProductionCount > 0 ? `${inProductionCount} currently shooting` : 'None shooting yet',
      icon: Clapperboard,
    },
    {
      label: 'Shoot days',
      value: shootDayCount,
      hint: 'Scheduled across all productions',
      icon: CalendarDays,
    },
    {
      label: 'Next shoot day',
      value: nextShootDay
        ? new Date(`${nextShootDay.shoot_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : '—',
      hint: nextShootProject ? `Day ${nextShootDay?.day_number ?? '?'} · ${nextShootProject.name}` : 'Nothing scheduled ahead',
      icon: Calendar,
    },
    {
      label: 'Scenes',
      value: sceneCount,
      hint: 'Detected from imported scripts',
      icon: ListChecks,
    },
  ]

  // The production workflow, linked into the most recent production
  const workflow = [
    { step: 1, title: 'Import the script', body: 'Upload a PDF or FDX and scenes are detected automatically.', icon: FileCode2, section: 'scripts' },
    { step: 2, title: 'Break down scenes', body: 'Tag cast, props, and locations for every scene.', icon: ListChecks, section: 'breakdown' },
    { step: 3, title: 'Build the schedule', body: 'Drag scene strips onto shoot days; conflicts are flagged live.', icon: Calendar, section: 'schedule' },
    { step: 4, title: 'Send call sheets', body: 'Generate call sheets for each day and share them with the crew.', icon: FileText, section: 'callsheets' },
  ]

  return (
    <div className="flex-1 space-y-8 p-4 sm:p-8 w-full max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
            {activeOrg?.name || 'Studio'} workspace
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s where your productions stand today.
          </p>
        </div>

        <Link href="/projects/new">
          <Button className="h-10 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-sm cursor-pointer">
            <Plus className="size-4 mr-1.5" />
            New production
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between p-5 pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="size-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-2xl font-bold text-foreground">{m.value}</div>
              <p className="text-xs text-muted-foreground mt-1 truncate">{m.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Productions Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Your productions</h2>
          <p className="text-sm text-muted-foreground">Feature films, series, and commercials in this workspace.</p>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed bg-card/50 shadow-none p-8 sm:p-12 text-center">
            <div className="flex flex-col items-center max-w-md mx-auto space-y-4">
              <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Film className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-foreground">No productions yet</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Create your first production, then import a script and CallSheetPro will help you build the stripboard.
                </p>
              </div>
              <Link href="/projects/new">
                <Button className="h-10 px-4 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer">
                  <Plus className="size-4 mr-1.5" />
                  Create first production
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full bg-card shadow-sm group-hover:border-amber-500/50 group-hover:shadow-md transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[11px] font-mono">
                        {project.project_type}
                      </Badge>
                      <Badge variant={project.status === 'PRODUCTION' ? 'success' : 'secondary'} className="text-[11px]">
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors mt-2">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || 'No description provided.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="flex items-center justify-between text-sm text-amber-700 dark:text-amber-400 font-medium">
                      Open production
                      <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Production workflow guide */}
      <section className="border-t border-border pt-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">How a production flows</h2>
          <p className="text-sm text-muted-foreground">
            {latestProject ? `Each step opens in ${latestProject.name}.` : 'Create a production to get started.'}
          </p>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {workflow.map((w) => (
            <li key={w.step}>
              <Link
                href={latestProject ? `/projects/${latestProject.id}/${w.section}` : '/projects/new'}
                className="group flex h-full flex-col gap-2 p-4 rounded-xl bg-card border border-border hover:border-amber-500/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="size-6 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center">
                    {w.step}
                  </span>
                  <w.icon className="size-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                  <span className="text-sm font-semibold text-foreground">{w.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{w.body}</p>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
