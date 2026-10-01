import { redirect } from 'next/navigation'
import { latestActiveProjectId } from '@/features/organizations/active-org'

/** Opens this section in the latest production of the organization the user is working in. */
export default async function BreakdownRedirect() {
  const projectId = await latestActiveProjectId()
  redirect(projectId ? `/projects/${projectId}/breakdown` : '/projects')
}
