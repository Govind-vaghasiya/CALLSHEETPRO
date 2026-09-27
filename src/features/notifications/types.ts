import { NotificationType } from '@/types/database'

export interface NotificationItem {
  id: string
  project_id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  link_url: string | null
  is_read: boolean
  created_at: string
}
