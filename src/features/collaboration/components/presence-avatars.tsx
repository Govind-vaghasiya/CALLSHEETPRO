'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Users, Circle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyDisplayNameAction } from '../actions'

interface PresentUser {
  userId: string
  name: string
  section: string
}

const COLORS = ['bg-emerald-600', 'bg-indigo-600', 'bg-amber-600', 'bg-rose-600', 'bg-sky-600', 'bg-violet-600']
const colorFor = (id: string) => COLORS[Array.from(id).reduce((h, c) => h + c.charCodeAt(0), 0) % COLORS.length]
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const SECTION_LABELS: Record<string, string> = {
  scripts: 'Script',
  breakdown: 'Breakdown',
  schedule: 'Schedule',
  resources: 'Cast & Crew',
  availability: 'Availability',
  callsheets: 'Call Sheets',
  reports: 'Reports',
  settings: 'Settings',
}

/** Who is looking at this production right now (Supabase Realtime presence). */
export function PresenceAvatars({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const section = SECTION_LABELS[pathname.split('/')[3] || ''] || 'Overview'
  const [me, setMe] = useState<{ id: string; name: string } | null>(null)
  const [present, setPresent] = useState<PresentUser[]>([])
  const [hovered, setHovered] = useState<PresentUser | null>(null)

  useEffect(() => {
    getMyDisplayNameAction().then(setMe)
  }, [])

  useEffect(() => {
    if (!me) return
    const supabase = createClient()
    const channel = supabase.channel(`presence:project:${projectId}`, { config: { presence: { key: me.id } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresentUser>()
        // one entry per person (a user may have several tabs open)
        setPresent(Object.values(state).map((entries) => entries[entries.length - 1]))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track({ userId: me.id, name: me.name, section })
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, me, section])

  const others = present.filter((p) => p.userId !== me?.id)
  const shown: PresentUser[] = me ? [{ userId: me.id, name: me.name, section }, ...others] : others

  return (
    <div className="relative flex items-center gap-1.5 bg-card/80 border border-border/80 rounded-full px-2.5 py-1">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1 shrink-0">
        <Users className="size-3.5 text-indigo-700 dark:text-indigo-400" />
        <span className="hidden sm:inline font-semibold text-subtle-foreground">
          {others.length === 0 ? 'Only you' : `${others.length + 1} here`}
        </span>
      </div>

      <div className="flex -space-x-2 items-center">
        {shown.map((user) => (
          <div
            key={user.userId}
            onMouseEnter={() => setHovered(user)}
            onMouseLeave={() => setHovered(null)}
            className="relative"
          >
            <div
              className={`size-6 rounded-full ${colorFor(user.userId)} text-white font-bold text-[10px] flex items-center justify-center ring-2 ring-background`}
              aria-label={user.name}
            >
              {initials(user.name)}
            </div>
            <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
          </div>
        ))}
      </div>

      {hovered && (
        <div className="absolute top-full right-0 mt-2 w-48 p-2.5 rounded-xl bg-popover border border-border shadow-xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="text-xs font-bold text-foreground truncate">
            {hovered.name}
            {hovered.userId === me?.id ? ' (you)' : ''}
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-border/80 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Circle className="size-2 fill-emerald-500 text-emerald-600" />
            <span>
              Viewing <strong className="text-foreground">{hovered.section}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
