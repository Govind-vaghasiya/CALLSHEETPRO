'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActivityLogEntry, ActivityType } from './types'
import { recordActivity } from './lib/activity'

/** Real activity feed for a project, newest first. */
export async function getActivityFeedAction(projectId: string): Promise<ActivityLogEntry[]> {
  const supabase = await createClient()
  // Read under RLS: only project members get rows back
  const { data: rows } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (!rows || rows.length === 0) return []

  // user_profiles is only readable for your own row, so names are resolved with the service key
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id)))
  const { data: profiles } = userIds.length
    ? await createAdminClient().from('user_profiles').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nameById = new Map((profiles || []).map((p) => [p.id, p.full_name]))

  return rows.map((r) => {
    const details = (r.details || {}) as { title?: string; description?: string | null }
    return {
      id: r.id,
      projectId,
      type: r.action as ActivityType,
      title: details.title || r.action.replace(/_/g, ' ').toLowerCase(),
      description: details.description || '',
      userName: (r.user_id && nameById.get(r.user_id)) || 'A team member',
      timestamp: r.created_at,
    }
  })
}

/** Lets browser-side modules (schedule, versions) add to the activity feed. */
export async function logActivityAction(projectId: string, type: ActivityType, title: string, description?: string) {
  await recordActivity(projectId, type, title, description)
}

/** Display name for live presence. */
export async function getMyDisplayNameAction(): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('user_profiles').select('full_name').eq('id', user.id).maybeSingle()
  return { id: user.id, name: profile?.full_name || user.email?.split('@')[0] || 'Team member' }
}
