'use client'

import React, { useEffect, useState } from 'react'
import { getActivityFeedAction } from '../actions'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import {
  History,
  X,
  FileCheck2,
  Calendar,
  ShieldCheck,
  FileText,
  UserPlus,
  MessageSquare,
  Clock,
  Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ActivityLogEntry } from '../types'

interface ActivityFeedDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

const SCHEDULE_TYPES = ['SCHEDULE_MOVE', 'SHOOT_DAY_ADDED', 'SHOOT_DAY_DELETED', 'SCHEDULE_RESTORED', 'PROPOSAL_APPLIED', 'REVISION_CREATED']
const SCRIPT_TYPES = ['SCRIPT_UPLOADED', 'DRAFT_CHANGED']

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

export function ActivityFeedDrawer({ isOpen, onClose, projectId }: ActivityFeedDrawerProps) {
  useModalBehavior(isOpen, onClose)
  const [filterType, setFilterType] = useState<string>('ALL')
  const [activities, setActivities] = useState<ActivityLogEntry[] | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    getActivityFeedAction(projectId).then((rows) => {
      if (!cancelled) setActivities(rows)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, projectId])

  if (!isOpen) return null

  const filteredActivities = (activities || []).filter((item) => {
    if (filterType === 'ALL') return true
    if (filterType === 'CALL_SHEETS') return item.type === 'CALL_SHEET_PUBLISHED'
    if (filterType === 'SCHEDULE') return SCHEDULE_TYPES.includes(item.type)
    if (filterType === 'SCRIPTS') return SCRIPT_TYPES.includes(item.type)
    return true
  })

  const getActivityIcon = (type: ActivityLogEntry['type']) => {
    switch (type) {
      case 'CALL_SHEET_PUBLISHED':
        return <FileCheck2 className="size-4 text-emerald-700 dark:text-emerald-400" />
      case 'SCHEDULE_MOVE':
        return <Calendar className="size-4 text-amber-700 dark:text-amber-400" />
      case 'UNION_RULE_UPDATED':
        return <ShieldCheck className="size-4 text-indigo-700 dark:text-indigo-400" />
      case 'REVISION_CREATED':
        return <FileText className="size-4 text-purple-700 dark:text-purple-400" />
      case 'RESOURCE_ADDED':
        return <UserPlus className="size-4 text-blue-700 dark:text-blue-400" />
      default:
        return <MessageSquare className="size-4 text-muted-foreground" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-md bg-background border-l border-border shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-2">
            <History className="size-5 text-indigo-700 dark:text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-foreground tracking-tight">Production Activity Feed</h3>
              <p className="text-xs text-muted-foreground">Who changed what in this production</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground rounded-full size-8"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-3 border-b border-border bg-background flex items-center gap-1.5 overflow-x-auto">
          <Filter className="size-3 text-faint shrink-0 mr-1" />
          {[
            { id: 'ALL', label: 'All Activity' },
            { id: 'SCHEDULE', label: 'Schedule' },
            { id: 'CALL_SHEETS', label: 'Call Sheets' },
            { id: 'SCRIPTS', label: 'Scripts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                filterType === tab.id
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Activity Timeline List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 divide-y divide-border">
          {activities === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {activities !== null && filteredActivities.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No activity yet. Publishing call sheets, changing shoot days, and uploading scripts will show up here.
            </p>
          )}
          {filteredActivities.map((item) => (
            <div key={item.id} className="pt-3 first:pt-0 flex items-start gap-3">
              <div className="size-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0 mt-0.5">
                {getActivityIcon(item.type)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-foreground">{item.title}</h4>
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                    <Clock className="size-2.5" />
                    {timeAgo(item.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-1">
                  <span className="size-1.5 rounded-full bg-indigo-400" />
                  <span>By <strong>{item.userName}</strong></span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-card/60 text-center text-[11px] text-muted-foreground">
          Entries are kept permanently for this production.
        </div>
      </div>
    </div>
  )
}
