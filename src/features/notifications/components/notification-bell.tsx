'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Bell, FileText, AlertTriangle, Calendar, Check, CheckCheck, Clock } from 'lucide-react'
import type { NotificationItem } from '../types'
import { useDismiss } from '@/components/ui/use-dismiss'
import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '../actions'

interface NotificationBellProps {
  projectId: string
}

export function NotificationBell({ projectId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useDismiss(isOpen, () => setIsOpen(false))

  async function loadNotifications() {
    try {
      const data = await getNotificationsAction(projectId)
      setNotifications(data)
    } catch (err) {
      console.error('Failed to load notifications:', err)
    }
  }

  useEffect(() => {
    if (projectId) {
      loadNotifications()
    }
  }, [projectId])


  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function handleMarkRead(id: string) {
    await markNotificationAsReadAction(projectId, id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
  }

  async function handleMarkAllRead() {
    await markAllNotificationsAsReadAction(projectId)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'CALL_SHEET_PUBLISHED':
      case 'CALL_SHEET_REVISED':
        return <FileText className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
      case 'CONFLICT_DETECTED':
        return <AlertTriangle className="size-4 text-rose-700 dark:text-rose-400 shrink-0" />
      default:
        return <Calendar className="size-4 text-amber-700 dark:text-amber-400 shrink-0" />
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
        title="Production Alerts & Call Times"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-500 ring-2 ring-background animate-pulse" />
        )}
      </button>

      {/* Notification Dropdown Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/80 bg-card/60">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-700 dark:text-amber-400" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Production Feed ({unreadCount} New)
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 font-mono"
              >
                <CheckCheck className="size-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs font-mono">
                No production alerts at this time.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 flex items-start gap-3 transition-colors ${
                    notif.is_read ? 'bg-background/40 text-muted-foreground' : 'bg-card/40 text-foreground font-medium'
                  }`}
                >
                  <div className="pt-0.5">{getNotificationIcon(notif.type)}</div>

                  <div className="flex-1 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{notif.title}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">
                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">{notif.message}</p>

                    {notif.link_url && (
                      <Link
                        href={notif.link_url}
                        onClick={() => {
                          handleMarkRead(notif.id)
                          setIsOpen(false)
                        }}
                        className="inline-block text-[10px] font-mono text-amber-700 dark:text-amber-400 hover:underline pt-0.5"
                      >
                        View Details →
                      </Link>
                    )}
                  </div>

                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      className="text-faint hover:text-emerald-700 dark:hover:text-emerald-400 p-1 rounded"
                      title="Mark as read"
                    >
                      <Check className="size-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
