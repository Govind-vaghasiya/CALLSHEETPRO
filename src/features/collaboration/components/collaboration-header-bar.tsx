'use client'

import React, { useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityFeedDrawer } from './activity-feed-drawer'
import { NotificationBell } from '@/features/notifications/components/notification-bell'

interface CollaborationHeaderBarProps {
  projectId: string
}

export function CollaborationHeaderBar({ projectId }: CollaborationHeaderBarProps) {
  const [isActivityFeedOpen, setIsActivityFeedOpen] = useState(false)

  return (
    <div className="flex items-center gap-1.5">
      {/* Activity Feed Drawer Trigger */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsActivityFeedOpen(true)}
        className="h-8 px-2.5 bg-card/80 border border-border/80 hover:bg-muted text-subtle-foreground hover:text-foreground text-xs font-mono rounded-full gap-1.5 cursor-pointer"
        title="View Production Activity Feed"
      >
        <History className="size-3.5 text-indigo-700 dark:text-indigo-400" />
        <span className="hidden sm:inline font-sans">Activity</span>
      </Button>

      {/* Smart Notifications Bell */}
      <NotificationBell projectId={projectId} />

      {/* Audit Slide-over Drawer */}
      <ActivityFeedDrawer
        isOpen={isActivityFeedOpen}
        onClose={() => setIsActivityFeedOpen(false)}
        projectId={projectId}
      />
    </div>
  )
}
