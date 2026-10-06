import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, ArrowLeft } from 'lucide-react'
import { ProjectTabs } from '@/components/layout/project-tabs'
import { CollaborationHeaderBar } from '@/features/collaboration/components/collaboration-header-bar'
import { getActiveOrganization } from '@/features/organizations/active-org'
import { SyncActiveOrganization } from '@/features/organizations/components/sync-active-organization'
import { ProjectTitle, ProjectTitleProvider } from '@/features/projects/components/project-title'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }
  const { active } = await getActiveOrganization()
  const otherOrg = active?.organization.id !== project.organization_id

  return (
    <ProjectTitleProvider>
    <div className="flex-1 flex flex-col w-full">
      {otherOrg && <SyncActiveOrganization organizationId={project.organization_id} />}
      {/* Project Sub-Header */}
      <div className="border-b border-border/80 bg-background/60 backdrop-blur-md px-4 sm:px-8 pt-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mr-2"
              >
                <ArrowLeft className="size-3.5" /> Productions
              </Link>
              <Badge variant="outline" className="text-[10px] font-mono">
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
            <ProjectTitle name={project.name} />
            {project.description && (
              <p className="text-sm text-muted-foreground max-w-2xl truncate">
                {project.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground font-mono">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>
                {project.start_date
                  ? new Date(project.start_date).toLocaleDateString()
                  : 'Start TBD'}{' '}
                →{' '}
                {project.target_end_date
                  ? new Date(project.target_end_date).toLocaleDateString()
                  : 'Wrap TBD'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>{project.timezone}</span>
            </div>
            <CollaborationHeaderBar projectId={id} />
          </div>
        </div>

        {/* Project Navigation Tabs */}
        <div className="mt-4 border-t border-border">
          <ProjectTabs projectId={id} />
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 w-full p-3 sm:p-5 max-w-full">{children}</div>
    </div>
    </ProjectTitleProvider>
  )
}
