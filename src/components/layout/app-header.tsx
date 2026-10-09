'use client'

import React, { useState, useTransition } from 'react'
import { useDismiss } from '@/components/ui/use-dismiss'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOutAction } from '@/features/auth/actions'
import { switchOrganizationAction } from '@/features/organizations/actions'
import { useFeedback } from '@/components/ui/feedback-provider'
import { ThemeSegmentedControl, ThemeToggleButton } from '@/components/theme/theme-toggle'
import { CollaborationHeaderBar } from '@/features/collaboration/components/collaboration-header-bar'
import {
  Settings,
  Clapperboard,
  Building2,
  ChevronDown,
  LogOut,
  Plus,
  Clock,
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  UserRound,
  Check,
  Loader2,
} from 'lucide-react'

interface AppHeaderProps {
  user: {
    email?: string
    profile?: {
      full_name?: string | null
      avatar_url?: string | null
      timezone?: string
    }
  }
  organizations: Array<{
    role: string
    organization: {
      id: string
      name: string
      slug: string
      logo_url?: string | null
    }
  }>
  /** Organization the user is working in (chosen in the switcher, remembered in a cookie) */
  activeOrgId: string
}

export function AppHeader({ user, organizations, activeOrgId }: AppHeaderProps) {
  const pathname = usePathname()
  // Inside a production (/projects/<id>/…) its activity feed and notifications sit in this bar
  const projectId = pathname.match(/^\/projects\/([0-9a-f-]{36})(?:\/|$)/i)?.[1] ?? null
  const router = useRouter()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isOrgMenuOpen, setIsOrgMenuOpen] = useState(false)
  const orgMenuRef = useDismiss(isOrgMenuOpen, () => setIsOrgMenuOpen(false))
  const userMenuRef = useDismiss(isUserMenuOpen, () => setIsUserMenuOpen(false))

  const { notify } = useFeedback()
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [, startSwitch] = useTransition()

  const activeMembership = organizations.find((m) => m.organization.id === activeOrgId) ?? organizations[0]
  const activeOrg = activeMembership?.organization || { id: '', name: 'Production Studio', slug: 'studio' }
  const userRole = activeMembership?.role || 'OWNER'

  const switchOrganization = (orgId: string) => {
    if (orgId === activeOrg.id) {
      setIsOrgMenuOpen(false)
      return
    }
    setSwitchingTo(orgId)
    startSwitch(async () => {
      try {
        const result = await switchOrganizationAction(orgId)
        if (result.error) {
          notify(result.error, 'error')
          return
        }
        // Productions belong to one organization, so switching lands on its dashboard
        router.push('/dashboard')
        router.refresh()
      } catch {
        notify('Could not switch organization. Please try again.', 'error')
      } finally {
        setSwitchingTo(null)
        setIsOrgMenuOpen(false)
      }
    })
  }

  // Inside a production, section links stay in that production instead of
  // jumping to whichever project was created most recently.
  const currentProjectId = pathname.match(/^\/projects\/([0-9a-f-]{36})/)?.[1]
  const inProject = (section: string, fallback: string) =>
    currentProjectId ? `/projects/${currentProjectId}/${section}` : fallback

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, match: '/dashboard' },
    { label: 'Productions', href: '/projects', icon: Clapperboard, match: '/projects' },
    { label: 'Schedule', href: inProject('schedule', '/schedule'), icon: Calendar, match: '/schedule' },
    { label: 'Cast & Crew', href: inProject('resources', '/resources'), icon: Users, match: '/resources' },
    { label: 'Call Sheets', href: inProject('callsheets', '/callsheets'), icon: FileText, match: '/callsheets' },
  ]

  const isActive = (match: string) => {
    if (match === '/projects') {
      // "Productions" is active on the list/new pages and project overview only
      return pathname === '/projects' || pathname === '/projects/new' || pathname === `/projects/${currentProjectId}`
    }
    const scoped = currentProjectId ? `/projects/${currentProjectId}${match}` : match
    return pathname === match || pathname.startsWith(`${match}/`) || pathname === scoped || pathname.startsWith(`${scoped}/`)
  }

  const displayName = user.profile?.full_name || user.email?.split('@')[0] || 'Producer'
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const navLinks = (compact: boolean) =>
    navItems.map((item) => {
      const active = isActive(item.match)
      return (
        <Link
          key={item.label}
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={`flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium transition-colors shrink-0 ${
            compact ? 'py-1.5' : 'py-2'
          } ${
            active
              ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <item.icon className="size-4" />
          {item.label}
        </Link>
      )
    })

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8 w-full">
        {/* Left: Brand + Org Switcher */}
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0" aria-label="CallSheetPro home">
            <div className="size-9 rounded-lg bg-card border border-border flex items-center justify-center shadow-sm group-hover:border-amber-500/50 transition-colors">
              <Clapperboard className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-bold tracking-wider text-base text-foreground font-mono hidden sm:inline-block">
              CALLSHEET<span className="text-amber-600 dark:text-amber-400">PRO</span>
            </span>
          </Link>

          {/* Org Selector */}
          <div className="relative min-w-0" ref={orgMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsOrgMenuOpen(!isOrgMenuOpen)
                setIsUserMenuOpen(false)
              }}
              aria-haspopup="menu"
              aria-expanded={isOrgMenuOpen}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border text-sm font-medium text-foreground hover:border-border-strong transition-colors cursor-pointer min-w-0"
            >
              <Building2 className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="max-w-[120px] sm:max-w-[180px] truncate">{activeOrg.name}</span>
              <span className="hidden sm:inline text-[11px] px-1.5 rounded bg-amber-500/10 text-amber-800 dark:text-amber-300 font-mono">
                {userRole}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </button>

            {isOrgMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 mt-2 w-64 rounded-xl border border-border bg-popover p-2 shadow-xl z-50 animate-in fade-in zoom-in-95"
              >
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Your organizations</div>
                <div className="space-y-1 my-1">
                  {organizations.map((item) => {
                    const isActive = item.organization.id === activeOrg.id
                    return (
                      <button
                        key={item.organization.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        disabled={switchingTo !== null}
                        onClick={() => switchOrganization(item.organization.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer disabled:cursor-wait ${
                          isActive ? 'bg-amber-500/10 text-foreground' : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="size-4 shrink-0 flex items-center justify-center">
                          {switchingTo === item.organization.id ? (
                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                          ) : isActive ? (
                            <Check className="size-3.5 text-amber-700 dark:text-amber-400" />
                          ) : null}
                        </span>
                        <span className="font-medium truncate flex-1">{item.organization.name}</span>
                        <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">{item.role}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="pt-2 mt-1 border-t border-border">
                  <Link
                    href="/org/settings"
                    role="menuitem"
                    onClick={() => setIsOrgMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Settings className="size-4" />
                    Organization settings
                  </Link>
                  <Link
                    href="/org/new"
                    role="menuitem"
                    onClick={() => setIsOrgMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-amber-700 dark:text-amber-400 hover:bg-muted transition-colors"
                  >
                    <Plus className="size-4" />
                    Create new organization
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Desktop Nav */}
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
          {navLinks(false)}
        </nav>

        {/* Right: (inside a production) Activity + notifications, then theme + user menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {projectId && <CollaborationHeaderBar projectId={projectId} />}
          <ThemeToggleButton />

          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsUserMenuOpen(!isUserMenuOpen)
                setIsOrgMenuOpen(false)
              }}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              aria-label="Account menu"
              className="flex items-center gap-1.5 p-1 rounded-full hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="size-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-zinc-950 font-bold text-xs flex items-center justify-center shadow-sm">
                {initials}
              </div>
              <ChevronDown className="size-3.5 text-muted-foreground hidden sm:block" />
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-popover p-2 shadow-xl z-50 animate-in fade-in zoom-in-95"
              >
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    Timezone: {user.profile?.timezone || 'UTC'}
                  </div>
                </div>

                <div className="px-3 py-2 border-t border-border space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Appearance</p>
                  <ThemeSegmentedControl />
                </div>

                <div className="p-1 border-t border-border">
                  <Link
                    href="/account"
                    role="menuitem"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <UserRound className="size-4" />
                    Account settings
                  </Link>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="size-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tablet & phone nav: same links, horizontally scrollable */}
      <nav aria-label="Main" className="lg:hidden flex items-center gap-1 overflow-x-auto no-scrollbar px-4 sm:px-8 pb-2">
        {navLinks(true)}
      </nav>
    </header>
  )
}
