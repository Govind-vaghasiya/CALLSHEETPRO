import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import { getProjectScenes } from '@/features/scripts/actions'
import { ScheduleBoard } from '@/features/scheduling/components/schedule-board'

export default async function ProjectSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  // Scenes belong to the project; drafts only revise them
  const scenes = await getProjectScenes(id)

  return (
    <div className="flex-1 w-full max-w-full space-y-3">
      <ScheduleBoard projectId={id} scenes={scenes} />
    </div>
  )
}
