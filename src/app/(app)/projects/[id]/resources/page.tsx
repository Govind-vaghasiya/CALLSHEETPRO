import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Drama, Users } from 'lucide-react'
import { getProjectById } from '@/features/projects/actions'
import { getResources, ensureDefaultDepartments } from '@/features/resources/actions'
import { ResourcesDirectory } from '@/features/resources/components/resources-directory'
import { getCastingDataAction } from '@/features/characters/actions'
import { CharactersPanel } from '@/features/characters/components/characters-panel'

export default async function ProjectResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ view?: string }>
}) {
  const { id } = await params
  const { view } = await searchParams
  const project = await getProjectById(id)

  if (!project) {
    notFound()
  }

  const showCharacters = view === 'characters'
  const casting = await getCastingDataAction(id)
  const uncast = casting.characters.filter((c) => !c.actor).length

  const tabs = [
    { href: `/projects/${id}/resources`, label: 'People & Assets', icon: Users, active: !showCharacters },
    {
      href: `/projects/${id}/resources?view=characters`,
      label: `Characters (${casting.characters.length})`,
      icon: Drama,
      active: showCharacters,
      badge: uncast > 0 ? `${uncast} not cast` : null,
    },
  ]

  let directory: React.ReactNode = null
  if (!showCharacters) {
    // Ensure default departments are available for this project
    await ensureDefaultDepartments(id)
    const resources = await getResources(id)
    const playing = Object.fromEntries(casting.people.filter((p) => p.playing.length).map((p) => [p.id, p.playing]))
    directory = (
      <ResourcesDirectory
        projectId={id}
        projectCurrency={project.project_settings?.currency || 'USD'}
        resources={resources}
        playingByPerson={playing}
      />
    )
  }

  return (
    <div className="space-y-4 w-full">
      <nav aria-label="Cast and crew views" className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              t.active ? 'border-amber-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
            {t.badge && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[11px]">
                {t.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
      {showCharacters ? <CharactersPanel projectId={id} initialData={casting} /> : directory}
    </div>
  )
}
