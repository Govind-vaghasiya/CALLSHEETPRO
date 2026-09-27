import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import { ProjectSettingsForm } from '@/features/projects/components/project-settings-form'

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const defaultWrap = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const defaultWrapStr = defaultWrap.toISOString().split('T')[0]

  return (
    <ProjectSettingsForm
      project={project}
      defaultStartDate={todayStr}
      defaultWrapDate={defaultWrapStr}
    />
  )
}
