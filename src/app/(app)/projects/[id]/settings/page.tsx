import React from 'react'
import { notFound } from 'next/navigation'
import { getProjectById } from '@/features/projects/actions'
import { ProjectSettingsForm } from '@/features/projects/components/project-settings-form'
import { getUserOrganizations } from '@/features/organizations/actions'
import { getOrgAiSettingsAction } from '@/features/organizations/ai-settings-actions'
import { AiKeySection } from '@/features/organizations/components/org-settings'

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

  // The AI key belongs to the production's organization; shown here too because this is where people look
  const org = (await getUserOrganizations()).find((m) => m.organization.id === project.organization_id)
  const ai = org ? await getOrgAiSettingsAction(org.organization.id) : null

  return (
    <ProjectSettingsForm
      project={project}
      defaultStartDate={todayStr}
      defaultWrapDate={defaultWrapStr}
      aiSection={
        org && ai && !('error' in ai) ? (
          <AiKeySection orgId={org.organization.id} orgName={org.organization.name} ai={ai} />
        ) : null
      }
    />
  )
}
