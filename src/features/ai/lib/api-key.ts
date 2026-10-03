/**
 * Server only. The AI (Anthropic) API key for a production: its organization's key, set once in
 * Organization settings and stored encrypted in Supabase Vault (migration 024). ANTHROPIC_API_KEY
 * in the environment is a fallback for local development.
 *
 * The key is decrypted here, used for the request, and never sent to the browser.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const AI_KEY_MISSING_MESSAGE =
  'AI is not set up for this organization yet. An owner or admin can add the API key in Organization settings (studio menu, top left).'

export async function getProjectAiKey(projectId: string): Promise<string | null> {
  // The signed-in user's own client: they only see projects they belong to
  const db = await createClient()
  const { data: project } = await db.from('projects').select('organization_id').eq('id', projectId).maybeSingle()

  if (project?.organization_id) {
    // Reading the key back is allowed for the service role only (see get_org_ai_key)
    const { data: key, error } = await createAdminClient().rpc('get_org_ai_key', { org_id: project.organization_id })
    if (!error && key) return key
  }
  return process.env.ANTHROPIC_API_KEY || null
}
