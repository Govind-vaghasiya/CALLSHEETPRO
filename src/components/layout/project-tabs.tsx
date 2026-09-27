'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileCode2,
  ListChecks,
  Calendar,
  Users,
  CalendarClock,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'

/** Ordered to follow the production workflow: script → breakdown → schedule → call sheets. */
const TABS = [
  { label: 'Overview', segment: '', icon: LayoutDashboard },
  { label: 'Script', segment: 'scripts', icon: FileCode2 },
  { label: 'Breakdown', segment: 'breakdown', icon: ListChecks },
  { label: 'Schedule', segment: 'schedule', icon: Calendar },
  { label: 'Cast & Crew', segment: 'resources', icon: Users },
  { label: 'Availability', segment: 'availability', icon: CalendarClock },
  { label: 'Call Sheets', segment: 'callsheets', icon: FileText },
  { label: 'Reports', segment: 'reports', icon: BarChart3 },
  { label: 'Settings', segment: 'settings', icon: Settings },
]

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const base = `/projects/${projectId}`

  return (
    <nav aria-label="Production sections" className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base
        const active = tab.segment ? pathname.startsWith(href) : pathname === base
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors shrink-0 ${
              active
                ? 'border-amber-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border-strong'
            }`}
          >
            <tab.icon className={`size-4 ${active ? 'text-amber-600 dark:text-amber-400' : ''}`} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
