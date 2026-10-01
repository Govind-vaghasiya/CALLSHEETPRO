import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getUserOrganizations } from './actions'

/** Cookie holding the organization the user last switched to (only an id; membership is always re-checked). */
export const ACTIVE_ORG_COOKIE = 'csp_active_org'

export type OrgMembership = Awaited<ReturnType<typeof getUserOrganizations>>[number]

/** The user's memberships plus the active one: the cookie's org if they still belong to it, else the first. */
export async function getActiveOrganization(): Promise<{
  organizations: OrgMembership[]
  active: OrgMembership | null
}> {
  const organizations = await getUserOrganizations()
  const chosen = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  const active = organizations.find((m) => m.organization.id === chosen) ?? organizations[0] ?? null
  return { organizations, active }
}

/** Most recent production in the active organization (for /schedule, /resources, … shortcuts). */
export async function latestActiveProjectId(): Promise<string | null> {
  const { active } = await getActiveOrganization()
  if (!active) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id')
    .eq('organization_id', active.organization.id)
    .order('created_at', { ascending: false })
    .limit(1)
  return data?.[0]?.id ?? null
}
