'use server'

import Anthropic from '@anthropic-ai/sdk'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserOrganizations } from './actions'

const MIGRATION_HINT =
  'Organization AI settings need a one-time database update: run supabase/migrations/024_org_ai_key.sql in the Supabase SQL Editor.'

export interface OrgAiSettings {
  /** A key is saved for this organization */
  configured: boolean
  /** Last 4 characters of the saved key, for recognising it */
  keyHint: string | null
  updatedAt: string | null
  updatedByName: string | null
  /** Owners and admins can change the key */
  canEdit: boolean
  /** No org key, but the server has ANTHROPIC_API_KEY set (local development) */
  usingServerKey: boolean
  /** Migration 024 has not been run yet */
  needsMigration: boolean
}

async function membership(orgId: string) {
  const memberships = await getUserOrganizations()
  return memberships.find((m) => m.organization.id === orgId) ?? null
}

export async function getOrgAiSettingsAction(orgId: string): Promise<OrgAiSettings | { error: string }> {
  const member = await membership(orgId)
  if (!member) return { error: 'You are not a member of that organization.' }

  const db = await createClient()
  const { data, error } = await db
    .from('organization_ai_settings')
    .select('key_hint, updated_at, updated_by')
    .eq('organization_id', orgId)
    .maybeSingle()

  let updatedByName: string | null = null
  if (data?.updated_by) {
    const { data: profile } = await db.from('user_profiles').select('full_name').eq('id', data.updated_by).maybeSingle()
    updatedByName = profile?.full_name || null
  }

  return {
    configured: Boolean(data),
    keyHint: data?.key_hint ?? null,
    updatedAt: data?.updated_at ?? null,
    updatedByName,
    canEdit: member.role === 'OWNER' || member.role === 'ADMIN',
    usingServerKey: !data && Boolean(process.env.ANTHROPIC_API_KEY),
    needsMigration: Boolean(error) && /organization_ai_settings/.test(error?.message || ''),
  }
}

/** Check the key with Anthropic (a free models lookup), then store it encrypted. */
export async function saveOrgAiKeyAction(orgId: string, apiKey: string): Promise<{ success?: boolean; error?: string }> {
  const member = await membership(orgId)
  if (!member) return { error: 'You are not a member of that organization.' }
  if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
    return { error: 'Only organization owners and admins can change the AI key.' }
  }

  const key = apiKey.trim()
  if (!key.startsWith('sk-ant-')) {
    return { error: 'That is not an Anthropic API key. Keys start with "sk-ant-" — create one at console.anthropic.com.' }
  }

  try {
    await new Anthropic({ apiKey: key, maxRetries: 1 }).models.list({ limit: 1 })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { error: 'Anthropic rejected this key. Check it was copied in full.' }
    if (error instanceof Anthropic.PermissionDeniedError) return { error: 'This key does not have permission to use the API.' }
    if (error instanceof Anthropic.APIError) {
      return { error: `Could not check the key with Anthropic (${error.status ?? 'network error'}). Try again.` }
    }
    throw error
  }

  const db = await createClient()
  const { error } = await db.rpc('set_org_ai_key', { org_id: orgId, api_key: key })
  if (error) {
    return { error: /set_org_ai_key|organization_ai_settings|supabase_vault/.test(error.message) ? MIGRATION_HINT : error.message }
  }
  revalidatePath('/org/settings')
  return { success: true }
}

export async function removeOrgAiKeyAction(orgId: string): Promise<{ success?: boolean; error?: string }> {
  const member = await membership(orgId)
  if (!member) return { error: 'You are not a member of that organization.' }
  if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
    return { error: 'Only organization owners and admins can change the AI key.' }
  }

  const db = await createClient()
  const { error } = await db.rpc('clear_org_ai_key', { org_id: orgId })
  if (error) return { error: /clear_org_ai_key/.test(error.message) ? MIGRATION_HINT : error.message }
  revalidatePath('/org/settings')
  return { success: true }
}
