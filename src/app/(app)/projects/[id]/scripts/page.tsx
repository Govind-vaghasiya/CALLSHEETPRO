import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import { getProjectScripts } from '@/features/scripts/actions'
import { ScriptsHub } from '@/features/scripts/components/scripts-hub'

export default async function ProjectScriptsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  const scripts = await getProjectScripts(id)

  return (
    <div className="flex-1 w-full max-w-full">
      <ScriptsHub
        projectId={id}
        projectName={project.name}
        scripts={scripts}
      />
    </div>
  )
}
