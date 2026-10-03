'use client'

import React, { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Database } from '@/types/database'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { getStripColorClasses } from '../lib/strip-colors'
import { searchScenes } from '../lib/scene-search'
import { formatEighths, sceneEighths, sceneTimeLabel } from '@/features/breakdown/lib/one-liners'

type SceneRow = Database['public']['Tables']['scenes']['Row']

interface AssignScenePickerProps {
  isOpen: boolean
  onClose: () => void
  dayLabel: string
  scenes: SceneRow[]
  onPick: (sceneId: string) => void
}

/** Searchable list of unscheduled scenes to drop onto a shoot day. */
export function AssignScenePicker({ isOpen, onClose, dayLabel, scenes, onPick }: AssignScenePickerProps) {
  const searchRef = useModalBehavior<HTMLInputElement>(isOpen, onClose)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return searchScenes(scenes, query, (s) => s)
  }, [scenes, query])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 id="assign-title" className="text-sm font-semibold text-foreground">
            Add scene to {dayLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close (Esc)"
            title="Close (Esc)"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) onPick(filtered[0].id)
              }}
              placeholder="Search scene #, location, one-liner, or dialogue"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-faint outline-none focus:border-amber-500"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto p-2 space-y-1">
          {scenes.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">Every scene is already scheduled.</li>
          )}
          {scenes.length > 0 && filtered.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">No unscheduled scene matches “{query}”.</li>
          )}
          {filtered.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s.id)}
                className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-muted cursor-pointer"
              >
                <span
                  className={`px-1.5 py-0.5 rounded border font-mono font-black text-xs shrink-0 ${
                    getStripColorClasses(s.int_ext, s.time_of_day).container
                  }`}
                >
                  {s.scene_number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2 text-[11px] font-mono uppercase text-muted-foreground">
                    <span className="truncate">
                      {(s.int_ext || 'INT').replace('_', '/')} · {sceneTimeLabel(s) || 'Day'} · {s.location_name || 'Untitled scene'}
                    </span>
                    <span className="shrink-0">{formatEighths(sceneEighths(s).eighths)} pg</span>
                  </span>
                  <span className={`block truncate text-sm ${s.synopsis?.trim() ? 'font-semibold text-foreground' : 'italic text-faint'}`}>
                    {s.synopsis?.trim() || 'No one-liner yet'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
