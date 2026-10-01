import React from 'react'
import { getActiveOrganization } from '@/features/organizations/active-org'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProjects } from '@/features/projects/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Calendar,
  Clock,
  Film,
  ArrowRight
} from 'lucide-react'

export default async function ProjectsPage() {
  const { active } = await getActiveOrganization()
  const activeOrg = active?.organization

  if (!activeOrg) {
    redirect('/org/new')
  }

  const projects = await getProjects(activeOrg.id)

  return (
    <div className="flex-1 space-y-8 p-4 sm:p-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {activeOrg.name} Productions
            </span>
            <Badge variant="outline" className="text-[10px]">
              {projects.length} Total
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Productions & Film Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your feature films, television episodes, commercials, and short films.
          </p>
        </div>

        <Link href="/projects/new">
          <Button className="h-10 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-lg shadow-amber-500/15 cursor-pointer">
            <Plus className="size-4 mr-1.5" />
            New Production
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="border-dashed border-border bg-background/40 p-12 text-center max-w-xl mx-auto my-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="size-16 rounded-2xl bg-card border border-border flex items-center justify-center text-amber-700 dark:text-amber-400 shadow-xl">
              <Film className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                No Productions in {activeOrg.name}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Create your first production project to start scheduling scenes, assigning crew, and generating call sheets.
              </p>
            </div>
            <Link href="/projects/new">
              <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer shadow-lg shadow-amber-500/10">
                <Plus className="size-4 mr-1.5" />
                Create First Production
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project: {
            id: string
            name: string
            description: string | null
            project_type: string
            status: string
            start_date: string | null
            timezone: string
          }) => (
            <Card
              key={project.id}
              className="border-border bg-card/60 hover:border-border-strong/90 transition-all flex flex-col justify-between group shadow-xl"
            >
              <CardHeader className="space-y-3 pb-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-mono border-border-strong">
                    {project.project_type}
                  </Badge>
                  <Badge
                    variant={
                      project.status === 'PRODUCTION'
                        ? 'success'
                        : project.status === 'PRE_PRODUCTION'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-xl text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    {project.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 text-xs mt-1.5 text-muted-foreground">
                    {project.description || 'No description provided.'}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-3 border-t border-border/80">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span>
                      {project.start_date
                        ? new Date(project.start_date).toLocaleDateString()
                        : 'TBD'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span>{project.timezone}</span>
                  </div>
                </div>

                <Link
                  href={`/projects/${project.id}`}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-background/80 hover:bg-muted/60 border border-border text-xs text-amber-700 dark:text-amber-400 font-medium transition-colors"
                >
                  <span>Open Production Workspace</span>
                  <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
