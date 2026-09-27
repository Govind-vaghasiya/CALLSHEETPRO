/**
 * Server-side helpers for the activity feed and team notifications.
 *
 * activity_logs and notifications have read policies but no insert policies, so rows are written
 * with the service key — only after the caller's own session proves they belong to the project.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json, NotificationType } from '@/types/database'
import type { ActivityType } from '../types'

async function currentMember(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isMember } = await supabase.rpc('is_project_member', { proj_id: projectId })
  return isMember ? user : null
}

/** Append an entry to the project's activity feed. Never throws — logging must not break the action. */
export async function recordActivity(
  projectId: string,
  type: ActivityType,
  title: string,
  description?: string,
  entity?: { type: string; id: string }
) {
  try {
    const user = await currentMember(projectId)
    if (!user) return
    await createAdminClient()
      .from('activity_logs')
      .insert({
        project_id: projectId,
        user_id: user.id,
        action: type,
        entity_type: entity?.type ?? null,
        entity_id: entity?.id ?? null,
        details: { title, description: description ?? null } as Json,
      })
  } catch (err) {
    console.error('Activity log failed:', err)
  }
}

/** Notify every other member of the project (in-app bell). */
export async function notifyProjectMembers(
  projectId: string,
  type: NotificationType,
  title: string,
  body: string,
  linkUrl: string
) {
  try {
    const user = await currentMember(projectId)
    if (!user) return
    const admin = createAdminClient()
    const { data: members } = await admin.from('project_members').select('user_id').eq('project_id', projectId)
    const rows = (members || [])
      .filter((m) => m.user_id !== user.id)
      .map((m) => ({ user_id: m.user_id, project_id: projectId, notification_type: type, title, body, link_url: linkUrl }))
    if (rows.length > 0) await admin.from('notifications').insert(rows)
  } catch (err) {
    console.error('Notification failed:', err)
  }
}
