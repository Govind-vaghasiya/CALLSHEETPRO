export type CollaboratorRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

export interface CollaboratorPresence {
  id: string
  userId: string
  name: string
  avatarUrl?: string
  role: CollaboratorRole
  currentRoute?: string
  lastActive: string
  isOnline: boolean
}

export type ResourceType = 'STRIPBOARD' | 'CALL_SHEET' | 'SCRIPT' | 'RESOURCE'

export interface LockState {
  id: string
  projectId: string
  resourceType: ResourceType
  resourceId: string
  lockedByUserId: string
  lockedByName: string
  lockedAt: string
  expiresAt: string
  isLocked: boolean
}

export type ActivityType =
  | 'SCHEDULE_MOVE'
  | 'CALL_SHEET_PUBLISHED'
  | 'STRIPBOARD_LOCKED'
  | 'STRIPBOARD_UNLOCKED'
  | 'REVISION_CREATED'
  | 'RESOURCE_ADDED'
  | 'COMMENT_ADDED'
  | 'UNION_RULE_UPDATED'
  | 'SHOOT_DAY_ADDED'
  | 'SHOOT_DAY_DELETED'
  | 'SCHEDULE_RESTORED'
  | 'PROPOSAL_APPLIED'
  | 'SCRIPT_UPLOADED'
  | 'DRAFT_CHANGED'
  | 'RESOURCE_REMOVED'

export interface ActivityLogEntry {
  id: string
  projectId: string
  type: ActivityType
  title: string
  description: string
  userName: string
  userAvatar?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface SceneComment {
  id: string
  sceneId: string
  userId: string
  userName: string
  userAvatar?: string
  content: string
  createdAt: string
}
