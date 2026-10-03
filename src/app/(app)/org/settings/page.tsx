import { redirect } from 'next/navigation'
import { getActiveOrganization } from '@/features/organizations/active-org'
import { getOrgAiSettingsAction } from '@/features/organizations/ai-settings-actions'
import { OrgSettings } from '@/features/organizations/components/org-settings'

/** Settings for the organization the user is working in (switch organizations in the header). */
export default async function OrgSettingsPage() {
  const { active } = await getActiveOrganization()
  if (!active) redirect('/org/new')

  const ai = await getOrgAiSettingsAction(active.organization.id)
  if ('error' in ai) redirect('/dashboard')

  return <OrgSettings orgId={active.organization.id} orgName={active.organization.name} role={active.role} ai={ai} />
}
