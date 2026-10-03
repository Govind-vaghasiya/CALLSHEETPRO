import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import { getProjectScenes } from '@/features/scripts/actions'
import { BreakdownHub } from '@/features/breakdown/components/breakdown-hub'


export default async function ProjectBreakdownPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ scene?: string }>
}) {
  const { id } = await params
  const { scene: initialSceneId } = await searchParams
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  // Scenes belong to the project; drafts only revise them
  const scenes = await getProjectScenes(id)

  return (
    <div className="flex-1 w-full max-w-full">
      <BreakdownHub
        projectId={id}
        projectName={project.name}
        scenes={scenes}
        initialSceneId={initialSceneId}
      />
    </div>
  )
}
