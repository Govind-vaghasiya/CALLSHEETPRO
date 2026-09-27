import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import {
  getResourceById,
  getDepartmentsAndRoles,
  getResourceSceneUsageAction,
} from '@/features/resources/actions'
import { getCastingDataAction } from '@/features/characters/actions'
import { ResourceForm } from '@/features/resources/components/resource-form'

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string; resourceId: string }>
}) {
  const { id, resourceId } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  const [resource, departments, sceneUsage, casting] = await Promise.all([
    getResourceById(resourceId),
    getDepartmentsAndRoles(id),
    getResourceSceneUsageAction(resourceId),
    getCastingDataAction(id),
  ])

  if (!resource) {
    notFound()
  }

  const currency = project.project_settings?.currency || 'USD'

  return (
    <ResourceForm
      projectId={id}
      projectCurrency={currency}
      departments={departments}
      initialResource={resource}
      sceneUsage={sceneUsage}
      playing={casting.people.find((p) => p.id === resourceId)?.playing || []}
    />
  )
}
