import { createAdminClient } from '@/lib/supabase/admin'
import type { GuestPermission } from '@/types/database'

export interface GuestAccess {
  tokenId: string
  projectId: string
  label: string
  permissions: GuestPermission[]
}

/**
 * Resolve a guest link. Guests have no Supabase session, so this (and only this) path reads with
 * the service key — after checking the token is active and unexpired, and only for its project.
 */
export async function resolveGuestToken(token: string): Promise<GuestAccess | null> {
  if (!/^[a-f0-9]{16,128}$/i.test(token)) return null
  const admin = createAdminClient()

  const { data: row } = await admin
    .from('guest_tokens')
    .select('*, guest_token_permissions(permission)')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle()
  if (!row) return null
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null

  await admin
    .from('guest_tokens')
    .update({ use_count: row.use_count + 1, last_used_at: new Date().toISOString() })
    .eq('id', row.id)

  const permissions = ((row as unknown as { guest_token_permissions: Array<{ permission: GuestPermission }> })
    .guest_token_permissions || []).map((p) => p.permission)

  return { tokenId: row.id, projectId: row.project_id, label: row.label, permissions }
}
