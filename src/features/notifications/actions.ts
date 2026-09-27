'use server'

import { createClient } from '@/lib/supabase/server'
import type { NotificationItem } from './types'

/** The signed-in user's notifications for a project, newest first (RLS: own rows only). */
export async function getNotificationsAction(projectId: string): Promise<NotificationItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50)

  return (data || []).map((n) => ({
    id: n.id,
    project_id: projectId,
    user_id: n.user_id,
    type: n.notification_type,
    title: n.title,
    message: n.body || '',
    link_url: n.link_url,
    is_read: n.is_read,
    created_at: n.created_at,
  }))
}

export async function markNotificationAsReadAction(_projectId: string, notificationId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
  return { success: !error }
}

export async function markAllNotificationsAsReadAction(projectId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('is_read', false)
  return { success: !error }
}
