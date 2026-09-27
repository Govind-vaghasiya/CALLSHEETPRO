import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import { getDepartmentsAndRoles } from '@/features/resources/actions'
import { ResourceForm } from '@/features/resources/components/resource-form'

export default async function NewResourcePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  const departments = await getDepartmentsAndRoles(id)
  const currency = project.project_settings?.currency || 'USD'

  return (
    <ResourceForm
      projectId={id}
      projectCurrency={currency}
      departments={departments}
    />
  )
}
