'use client'

import React, { useState, useEffect } from 'react'
import { useFeedback } from '@/components/ui/feedback-provider'
import type { ScheduleVersionSnapshot, RevisionColor } from '../types'
import {
  getScheduleVersionsAction,
  restoreScheduleVersionAction,
} from '../actions'
import { CreateVersionModal } from './create-version-modal'
import { VersionDiffModal } from './version-diff-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GitBranch,
  Camera,
  GitCompare,
  RotateCcw,
  RefreshCw,
  Clock,
  Layers,
} from 'lucide-react'

interface ScheduleVersionSwitcherProps {
  projectId: string
  onScheduleRestored: () => void
}

const REVISION_COLOR_CLASSES: Record<RevisionColor, string> = {
  WHITE: 'bg-white text-zinc-950 border-zinc-300',
  BLUE: 'bg-blue-600 text-white border-blue-500',
  PINK: 'bg-pink-500 text-white border-pink-400',
  YELLOW: 'bg-amber-400 text-zinc-950 border-amber-300',
  GREEN: 'bg-emerald-500 text-zinc-950 border-emerald-400',
  GOLDENROD: 'bg-yellow-600 text-white border-yellow-500',
  BUFF: 'bg-amber-200 text-amber-950 border-amber-300',
  SALMON: 'bg-rose-400 text-zinc-950 border-rose-300',
  CHERRY: 'bg-red-700 text-white border-red-600',
  TAN: 'bg-stone-400 text-stone-950 border-stone-300',
}

export function ScheduleVersionSwitcher({
  projectId,
  onScheduleRestored,
}: ScheduleVersionSwitcherProps) {
  const { confirm, notify } = useFeedback()
  const [versions, setVersions] = useState<ScheduleVersionSnapshot[]>([])
  const [activeVersionId, setActiveVersionId] = useState<string>('working-draft')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDiffOpen, setIsDiffOpen] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const loadVersions = async () => {
    const list = await getScheduleVersionsAction(projectId)
    setVersions(list)
  }

  useEffect(() => {
    loadVersions()
  }, [projectId])

  const activeVersion = versions.find((v) => v.id === activeVersionId)

  const handleRestore = async () => {
    if (!activeVersion) return
    const ok = await confirm({
      title: `Restore "${activeVersion.versionName}"?`,
      message: 'It becomes the working schedule. The current schedule is saved as an automatic backup version first.',
      confirmLabel: 'Restore',
    })
    if (ok) {
      setIsRestoring(true)
      const res = await restoreScheduleVersionAction(projectId, activeVersion.id)
      setIsRestoring(false)

      if (res.success) {
        if (res.skippedScenes) {
          notify(`${res.skippedScenes} scene(s) in that version no longer exist and were skipped.`, 'info')
        }
        setActiveVersionId('working-draft')
        setVersions(await getScheduleVersionsAction(projectId))
        onScheduleRestored()
      } else {
        notify(res.error || 'Failed to restore schedule snapshot', 'error')
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
      {/* VERSION SELECTOR */}
      <div className="flex items-center gap-1.5 bg-card border border-border rounded-xl p-1">
        <GitBranch className="size-3.5 text-amber-600 dark:text-amber-500 ml-1.5" />
        <select
          value={activeVersionId}
          onChange={(e) => setActiveVersionId(e.target.value)}
          className="bg-transparent text-foreground text-xs font-mono font-bold outline-none cursor-pointer pr-2"
        >
          <option value="working-draft" className="bg-background text-foreground">
            Live Working Draft
          </option>
          {versions.map((v) => (
            <option key={v.id} value={v.id} className="bg-background text-foreground">
              {v.versionName} ({new Date(v.createdAt).toLocaleDateString()})
            </option>
          ))}
        </select>

        {activeVersion && (
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase border ${
              REVISION_COLOR_CLASSES[activeVersion.revisionColor] || 'bg-muted text-subtle-foreground'
            }`}
          >
            {activeVersion.revisionColor}
          </span>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsCreateOpen(true)}
        className="border-border text-subtle-foreground hover:text-foreground text-xs font-mono h-8 cursor-pointer"
        title="Take an immutable snapshot of current schedule"
      >
        <Camera className="size-3 mr-1 text-amber-700 dark:text-amber-400" />
        <span>+ Snapshot</span>
      </Button>

      {versions.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsDiffOpen(true)}
          className="border-border text-subtle-foreground hover:text-foreground text-xs font-mono h-8 cursor-pointer"
          title="Compare diffs between schedule versions"
        >
          <GitCompare className="size-3 mr-1 text-blue-700 dark:text-blue-400" />
          <span>Compare Diffs</span>
        </Button>
      )}

      {activeVersionId !== 'working-draft' && activeVersion && (
        <Button
          type="button"
          size="sm"
          onClick={handleRestore}
          disabled={isRestoring}
          className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono h-8 cursor-pointer font-bold"
          title="Restore this historical snapshot to active schedule"
        >
          <RotateCcw className={`size-3 mr-1 ${isRestoring ? 'animate-spin' : ''}`} />
          <span>Restore Version</span>
        </Button>
      )}

      {/* MODALS */}
      <CreateVersionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        projectId={projectId}
        onVersionSaved={() => {
          loadVersions()
        }}
      />

      <VersionDiffModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        versions={versions}
      />
    </div>
  )
}
