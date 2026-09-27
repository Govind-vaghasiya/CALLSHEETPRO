'use client'

import React, { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Pencil, Plus, Search, Trash2, UserRound, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback-provider'
import {
  castCharacterAction,
  createCharacterAction,
  deleteCharacterAction,
  getCastingDataAction,
  renameCharacterAction,
  setCastNumberAction,
  type CastingData,
  type CharacterOverview,
} from '../actions'

const NEW_ACTOR = '__new__'

/** Cast list: every character in the script, who plays them, and where they appear. */
export function CharactersPanel({ projectId, initialData }: { projectId: string; initialData: CastingData }) {
  const [data, setData] = useState(initialData)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'UNCAST' | 'CAST'>('ALL')
  const [newName, setNewName] = useState('')
  const [, startTransition] = useTransition()
  const { confirm, notify } = useFeedback()

  const reload = () => getCastingDataAction(projectId).then(setData)
  const run = (work: () => Promise<{ error?: string } | { success: boolean; error?: string } | unknown>) =>
    startTransition(async () => {
      const res = (await work()) as { error?: string } | undefined
      if (res?.error) notify(res.error, 'error')
      await reload()
    })

  const uncastCount = data.characters.filter((c) => !c.actor).length
  const visible = useMemo(() => {
    const q = query.trim().toUpperCase()
    return data.characters.filter(
      (c) =>
        (filter === 'ALL' || (filter === 'UNCAST' ? !c.actor : !!c.actor)) &&
        (!q || c.name.includes(q) || (c.actor?.name || '').toUpperCase().includes(q))
    )
  }, [data.characters, query, filter])

  if (data.setupRequired) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-2 text-sm">
        <p className="font-semibold text-foreground">One-time database setup needed</p>
        <p className="text-muted-foreground">
          Run <code className="font-mono">supabase/migrations/020_characters.sql</code> in the Supabase dashboard (SQL Editor →
          paste → Run), then reload this page. Existing cast will be converted into characters automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search characters or actors…"
            className="pl-8 h-9 text-sm bg-card"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          aria-label="Filter by casting"
          className={`h-9 px-2 rounded-lg border bg-card text-sm cursor-pointer ${filter !== 'ALL' ? 'border-amber-500/60' : 'border-border'}`}
        >
          <option value="ALL">All characters ({data.characters.length})</option>
          <option value="UNCAST">Not cast yet ({uncastCount})</option>
          <option value="CAST">Cast ({data.characters.length - uncastCount})</option>
        </select>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newName.trim()) return
            run(async () => {
              const r = await createCharacterAction(projectId, newName)
              setNewName('')
              return r
            })
          }}
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New character, e.g. LAKHAN"
            className="h-9 w-56 text-sm bg-card"
          />
          <Button type="submit" className="h-9 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer">
            <Plus className="size-4 mr-1" /> Add
          </Button>
        </form>
      </div>

      {uncastCount > 0 && filter === 'ALL' && (
        <p className="text-sm text-muted-foreground">
          {uncastCount} character{uncastCount === 1 ? ' is' : 's are'} not cast yet. Pick who plays them — every scene,
          call sheet, and report updates automatically.
        </p>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-16">Cast #</th>
              <th className="text-left font-medium px-3 py-2">Character</th>
              <th className="text-left font-medium px-3 py-2">Played by</th>
              <th className="text-right font-medium px-3 py-2 w-28">Scenes</th>
              <th className="px-3 py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                  {data.characters.length === 0
                    ? 'No characters yet. Importing a script adds its speaking characters automatically, or add one above.'
                    : 'No character matches.'}
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <CharacterRow
                key={`${c.id}-${c.castNumber}`}
                projectId={projectId}
                character={c}
                people={data.people}
                onCast={(actor) => run(() => castCharacterAction(projectId, c.id, actor))}
                onRename={(name) =>
                  run(async () => {
                    const r = await renameCharacterAction(projectId, c.id, name)
                    if (r.merged) notify(`Merged into the existing character ${name.toUpperCase()}`, 'success')
                    return r
                  })
                }
                onNumber={(n) => run(() => setCastNumberAction(projectId, c.id, n))}
                onDelete={async () => {
                  const ok = await confirm({
                    title: `Delete ${c.name}?`,
                    message: `It is removed from ${c.sceneCount} scene breakdown${c.sceneCount === 1 ? '' : 's'}, call sheets, and reports. The actor stays in Cast & Crew.`,
                    confirmLabel: 'Delete character',
                    destructive: true,
                  })
                  if (ok) run(() => deleteCharacterAction(projectId, c.id))
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CharacterRow({
  projectId,
  character: c,
  people,
  onCast,
  onRename,
  onNumber,
  onDelete,
}: {
  projectId: string
  character: CharacterOverview
  people: CastingData['people']
  onCast: (actor: { id: string } | { newName: string } | null) => void
  onRename: (name: string) => void
  onNumber: (n: number) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(c.name)
  const [addingActor, setAddingActor] = useState(false)
  const [actorName, setActorName] = useState('')

  return (
    <tr className="hover:bg-muted/30 align-middle">
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          defaultValue={c.castNumber ?? ''}
          aria-label={`Cast number for ${c.name}`}
          onBlur={(e) => {
            const n = Number(e.target.value)
            if (n && n !== c.castNumber) onNumber(n)
          }}
          className="w-12 h-8 px-1.5 rounded-md border border-border bg-background text-center font-mono text-sm"
        />
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              setEditing(false)
              if (name.trim() && name.trim().toUpperCase() !== c.name) onRename(name)
            }}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8 text-sm font-mono uppercase" />
            <button type="submit" aria-label="Save name" className="p-1.5 rounded hover:bg-muted cursor-pointer">
              <Check className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => {
                setEditing(false)
                setName(c.name)
              }}
              className="p-1.5 rounded hover:bg-muted cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group inline-flex items-center gap-1.5 font-mono font-semibold text-foreground cursor-pointer"
            title="Rename this character everywhere"
          >
            {c.name}
            <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
          </button>
        )}
      </td>
      <td className="px-3 py-2">
        {addingActor ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!actorName.trim()) return
              onCast({ newName: actorName })
              setAddingActor(false)
              setActorName('')
            }}
          >
            <Input
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="Actor’s full name"
              autoFocus
              className="h-8 text-sm"
            />
            <button type="submit" aria-label="Add actor" className="p-1.5 rounded hover:bg-muted cursor-pointer">
              <Check className="size-4" />
            </button>
            <button type="button" aria-label="Cancel" onClick={() => setAddingActor(false)} className="p-1.5 rounded hover:bg-muted cursor-pointer">
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={c.actor?.id || ''}
              onChange={(e) => {
                const v = e.target.value
                if (v === NEW_ACTOR) setAddingActor(true)
                else onCast(v ? { id: v } : null)
              }}
              aria-label={`Who plays ${c.name}`}
              className={`h-8 max-w-[240px] px-2 rounded-md border text-sm bg-background cursor-pointer ${
                c.actor ? 'border-border' : 'border-amber-500/60 text-amber-800 dark:text-amber-300'
              }`}
            >
              <option value="">— Not cast yet —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.playing.length && p.id !== c.actor?.id ? ` (also ${p.playing.join(', ')})` : ''}
                </option>
              ))}
              <option value={NEW_ACTOR}>+ New actor…</option>
            </select>
            {c.actor && (
              <Link
                href={`/projects/${projectId}/resources/${c.actor.id}`}
                className="text-muted-foreground hover:text-foreground"
                title={`Open ${c.actor.name}`}
              >
                <UserRound className="size-4" />
              </Link>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-right text-muted-foreground">
        {c.sceneCount}
        {c.firstScene && <span className="text-xs"> · from Sc {c.firstScene}</span>}
      </td>
      <td className="px-3 py-2 text-right">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${c.name}`}
          className="p-1.5 rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-muted cursor-pointer"
        >
          <Trash2 className="size-4" />
        </button>
      </td>
    </tr>
  )
}
