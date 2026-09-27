'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type OrgActionState = {
  error?: string
  success?: string
}

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') +
    '-' +
    Math.random().toString(36).substring(2, 6)
  )
}

export async function createOrganizationAction(
  _prevState: OrgActionState | null,
  formData: FormData
): Promise<OrgActionState> {
  const name = formData.get('name') as string

  if (!name || name.trim().length === 0) {
    return { error: 'Please enter an organization or production company name.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const slug = generateSlug(name)
  const adminClient = createAdminClient()

  // 1. Create Organization via admin client to guarantee provisioning
  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .insert({
      name: name.trim(),
      slug,
      created_by: user.id,
    })
    .select('id, name, slug')
    .single()

  if (orgError) {
    return { error: orgError.message }
  }

  // 2. Add creator as OWNER in organization_members
  const { error: memberError } = await adminClient
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'OWNER',
      joined_at: new Date().toISOString(),
    })

  if (memberError) {
    return { error: memberError.message }
  }

  redirect('/dashboard')
}

export async function getUserOrganizations() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from('organization_members')
    .select(`
      role,
      organizations (
        id,
        name,
        slug,
        logo_url
      )
    `)
    .eq('user_id', user.id)

  if (!data || !Array.isArray(data)) {
    return []
  }

  interface OrgMembershipRow {
    role: string
    organizations: {
      id: string
      name: string
      slug: string
      logo_url?: string | null
    }
  }

  return (data as unknown as OrgMembershipRow[])
    .filter((item) => item && item.organizations)
    .map((item) => ({
      role: item.role,
      organization: item.organizations,
    }))
}

export async function getCurrentUserWithProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    ...user,
    profile: profile || {
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
      avatar_url: null,
      timezone: 'UTC',
    },
  }
}
