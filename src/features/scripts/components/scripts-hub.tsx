'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useFeedback } from '@/components/ui/feedback-provider'
import Link from 'next/link'
import {
  type ScriptDocumentWithStats,
  makeScriptCurrentAction,
  deleteScriptAction,
  getScriptDeleteImpactAction,
  linkUploadedScriptAction,
} from '@/features/scripts/actions'
import { mergeDraftIntoMasterAction } from '@/features/scripts/compare-actions'
import { useRouter } from 'next/navigation'
import {
  getRevisionColorMeta,
  formatScriptBadge,
} from '@/features/scripts/lib/revision-colors'
import { ScriptUploadModal } from './script-upload-modal'
import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  FileCode2,
  Upload,
  Layers,
  BookOpen,
  Calendar,
  CheckCircle2,
  Trash2,
  Star,
  Download,
  Clock,
  Sparkles,
  ArrowRight,
  Loader2,
} from 'lucide-react'

interface ScriptsHubProps {
  projectId: string
  projectName: string
  scripts: ScriptDocumentWithStats[]
}

export function ScriptsHub({
  projectId,
  projectName,
  scripts,
}: ScriptsHubProps) {
  const { confirm, notify } = useFeedback()
  const router = useRouter()
  const [mergingId, setMergingId] = useState<string | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [scriptToDelete, setScriptToDelete] = useState<ScriptDocumentWithStats | null>(null)
  const [deleteImpact, setDeleteImpact] = useState<Awaited<ReturnType<typeof getScriptDeleteImpactAction>>>(null)
  const [deleteScenesToo, setDeleteScenesToo] = useState(false)

  // Load what a delete would affect whenever a draft is picked for deletion
  useEffect(() => {
    if (!scriptToDelete) return
    let cancelled = false
    getScriptDeleteImpactAction(scriptToDelete.id).then((impact) => {
      if (!cancelled) {
        setDeleteImpact(impact)
        setDeleteScenesToo(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [scriptToDelete])
  const [isPending, startTransition] = useTransition()

  const currentScript = scripts.find((s) => s.is_current) || scripts[0]

  // Suggested next version and revision color
  const maxVersion = scripts.reduce((max, s) => Math.max(max, Number(s.version)), 0)
  // The newest draft, when it is newer than the one the app follows (uploaded to review first)
  const newerDraft = currentScript?.is_current
    ? scripts.find((s) => !s.is_current && (s.version > currentScript.version || (s.version === currentScript.version && s.created_at > currentScript.created_at)))
    : undefined
  const suggestedVersion = Math.floor(maxVersion) + 1

  const handleMakeCurrent = (scriptId: string) => {
    startTransition(async () => {
      const ok = await confirm({
        title: 'Make this draft current?',
        message:
          'Production scenes will be updated to match it. Changed scenes are flagged, breakdowns and schedule placement are kept, and scenes missing from this draft are listed in its notes.',
        confirmLabel: 'Make current',
      })
      if (!ok) return
      await makeScriptCurrentAction(scriptId, projectId)
    })
  }

  /** Merge a draft's changes into the master script, highlighted for review (in short steps) */
  const handleMerge = async (script: ScriptDocumentWithStats) => {
    const ok = await confirm({
      title: `Merge v${script.version} into the master script?`,
      message:
        'New and changed text goes into the master script highlighted in yellow, to accept or reject scene by scene. Breakdown, Cast & Crew links and schedule stay with each scene. Scenes missing from this draft are kept — delete them in Compare Drafts.',
      confirmLabel: 'Merge',
    })
    if (!ok) return
    setMergingId(script.id)
    try {
      const res = await mergeDraftIntoMasterAction(projectId, script.id)
      if ('error' in res) return notify(res.error, 'error')
      for (const s of res.skipped) notify(`Not merged — ${s.reason}`, 'error')
      if (res.parked.length) notify(`Not in the new draft, kept as: ${res.parked.join(', ')} — delete them in Compare Drafts if they are cut`, 'info')
      for (let stalls = 0; ; ) {
        const link = await linkUploadedScriptAction(projectId)
        if ('error' in link) {
          notify(`Merged, but linking cast & locations failed: ${link.error}`, 'error')
          break
        }
        if (link.remaining === 0) break
        stalls = link.linked === 0 ? stalls + 1 : 0
        if (stalls >= 2) break
      }
      const parts = [res.updated && `${res.updated} changed`, res.added && `${res.added} new`].filter(Boolean)
      notify(parts.length ? `Merged: ${parts.join(', ')} — highlighted for review` : 'Nothing to merge: the master already has this draft', 'success')
      router.push(`/projects/${projectId}/scripts/${script.id}?tab=reader`)
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not merge the draft.', 'error')
    } finally {
      setMergingId(null)
    }
  }

  const handleDeleteScript = () => {
    if (!scriptToDelete) return
    startTransition(async () => {
      await deleteScriptAction(scriptToDelete.id, projectId, { deleteScenes: deleteScenesToo })
      setScriptToDelete(null)
    })
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/projects/${projectId}`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {projectName}
            </Link>
            <span className="text-faint text-xs">/</span>
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Screenplay & Breakdown Engine
            </span>
            <Badge variant="outline" className="text-[10px]">
              {scripts.length} {scripts.length === 1 ? 'Draft' : 'Drafts'}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Script Revisions & Scene Ingestion
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ingest Final Draft (.fdx), PDF, or Fountain screenplays. Track Hollywood revision colors with automatic scene extraction.
          </p>
        </div>

        <Button
          onClick={() => setIsUploadModalOpen(true)}
          className="h-10 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold shadow-lg shadow-amber-500/15 cursor-pointer"
        >
          <Upload className="size-4 mr-1.5" />
          Upload New Draft
        </Button>
      </div>

      {/* Metrics Ribbon: four small cards and the wider Master Script card */}
      <div className={`grid grid-cols-2 gap-4 ${currentScript ? 'lg:grid-cols-6' : 'sm:grid-cols-4'}`}>
        {/* Metric 1: Current Draft */}
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Current Shooting Draft
            </CardTitle>
            <Star className="size-4 text-amber-700 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            {currentScript ? (
              <div className="space-y-1">
                <div className="text-xl font-bold text-foreground font-mono">
                  v{currentScript.version}
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  <span
                    className={`size-2 rounded-full ${
                      getRevisionColorMeta(currentScript.revision_color).dotBg
                    }`}
                  />
                  <span>{getRevisionColorMeta(currentScript.revision_color).label}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-faint italic mt-1">No drafts uploaded</div>
            )}
          </CardContent>
        </Card>

        {/* Metric 2: Extracted Scenes */}
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Extracted Scenes
            </CardTitle>
            <Layers className="size-4 text-amber-700 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              {currentScript?.total_scenes || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Detected sluglines</p>
          </CardContent>
        </Card>

        {/* Metric 3: Total Pages */}
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Script Pages
            </CardTitle>
            <BookOpen className="size-4 text-amber-700 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              {currentScript?.total_pages || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Standard pages</p>
          </CardContent>
        </Card>

        {/* Metric 4: Total Revisions */}
        <Card className="border-border bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-mono uppercase text-muted-foreground font-medium">
              Revisions In History
            </CardTitle>
            <Clock className="size-4 text-amber-700 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              {scripts.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Version history archived</p>
          </CardContent>
        </Card>

        {/* Master Script: the working script that drafts merge into */}
        {currentScript && (
          <Card className="col-span-2 border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-card/70 to-card">
            <CardContent className="flex h-full items-center gap-4 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-500 text-zinc-950 font-bold text-[10px] uppercase">Master Script</Badge>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground">
                  <span className={`size-2 rounded-full ring-1 ring-border ${getRevisionColorMeta(currentScript.revision_color).dotBg}`} />
                  v{currentScript.version} · {getRevisionColorMeta(currentScript.revision_color).label}
                </span>
              </div>
              <div className="truncate text-sm font-bold text-foreground" title={currentScript.file_name}>
                {currentScript.file_name}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {currentScript.total_scenes} scenes · {currentScript.total_pages} pages
                {currentScript.revision_date && ` · Issued ${formatIssueDate(currentScript.revision_date)}`}
              </p>
              {newerDraft && (
                <Link
                  href={`/projects/${projectId}/scripts/${newerDraft.id}?tab=compare&base=${currentScript.id}`}
                  className="inline-flex items-center gap-1 self-start rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                >
                  v{newerDraft.version} not merged yet — review
                  <ArrowRight className="size-3" />
                </Link>
              )}
              </div>
              <Link href={`/projects/${projectId}/scripts/${currentScript.id}`} className="shrink-0">
                <Button className="h-11 px-5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm cursor-pointer">
                  Open Master Script
                  <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty State */}
      {scripts.length === 0 ? (
        <Card className="border-dashed border-border bg-background/40 p-12 text-center max-w-xl mx-auto my-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="size-16 rounded-2xl bg-card border border-border flex items-center justify-center text-amber-700 dark:text-amber-400 shadow-xl">
              <FileCode2 className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">
                No Screenplay Uploaded Yet
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Upload your first screenplay draft in Final Draft (.fdx), PDF, or Fountain format. The ingestion engine will automatically extract all scenes, interior/exterior sluglines, and page counts.
              </p>
            </div>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer shadow-lg shadow-amber-500/10"
            >
              <Upload className="size-4 mr-1.5" />
              Upload Screenplay
            </Button>
          </div>
        </Card>
      ) : (
        /* Revisions History Catalog */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground tracking-tight">
              Screenplay Drafts & Revision History
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              Sorted by latest revision
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-background/80 font-mono text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Version & Revision</th>
                    <th className="py-3 px-4 font-semibold">File Name</th>
                    <th className="py-3 px-4 font-semibold">Format</th>
                    <th className="py-3 px-4 font-semibold">Pages</th>
                    <th className="py-3 px-4 font-semibold">Scenes</th>
                    <th className="py-3 px-4 font-semibold">Revision Date / Notes</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {scripts.map((script) => {
                    const colorMeta = getRevisionColorMeta(script.revision_color)
                    return (
                      <tr
                        key={script.id}
                        className={`hover:bg-muted/40 transition-colors ${
                          script.is_current ? 'bg-amber-500/[0.03]' : ''
                        }`}
                      >
                        {/* Version & Revision Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span
                              className="px-2.5 py-1 rounded-md border border-border bg-card text-xs font-semibold text-foreground inline-flex items-center gap-1.5"
                            >
                              <span className={`size-2 rounded-full ring-1 ring-border ${colorMeta.dotBg}`} />
                              v{script.version} · {colorMeta.label.split(' ')[0]}
                            </span>
                            {script.is_current && (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                                Master
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* File Name */}
                        <td className="py-3.5 px-4 font-medium text-foreground max-w-xs truncate">
                          <Link
                            href={`/projects/${projectId}/scripts/${script.id}`}
                            className="hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                          >
                            {script.file_name}
                          </Link>
                          {script.file_size_bytes && (
                            <div className="text-[10px] text-faint font-mono">
                              {(script.file_size_bytes / 1024).toFixed(1)} KB
                            </div>
                          )}
                        </td>

                        {/* Format */}
                        <td className="py-3.5 px-4 font-mono text-subtle-foreground">
                          <Badge variant="outline" className="text-[10px] font-mono border-border-strong">
                            {script.file_type}
                          </Badge>
                        </td>

                        {/* Pages */}
                        <td className="py-3.5 px-4 font-mono text-subtle-foreground">
                          {script.total_pages || '—'}
                        </td>

                        {/* Scenes */}
                        <td className="py-3.5 px-4 font-mono font-semibold text-amber-700 dark:text-amber-300">
                          {script.total_scenes || '—'}
                        </td>

                        {/* Notes */}
                        <td className="py-3.5 px-4 max-w-xs text-muted-foreground text-[11px]">
                          {script.revision_notes ? (
                            <div className="truncate text-subtle-foreground">
                              {script.revision_notes}
                            </div>
                          ) : (
                            <span className="text-faint italic">No notes</span>
                          )}
                          {script.revision_date && (
                            <div className="text-[10px] text-faint font-mono">
                              Issued: {formatIssueDate(script.revision_date)}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/projects/${projectId}/scripts/${script.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs border-border-strong text-subtle-foreground hover:text-foreground"
                              >
                                View Scenes
                              </Button>
                            </Link>

                            {!script.is_current && currentScript?.is_current && (
                              <Link href={`/projects/${projectId}/scripts/${script.id}?tab=compare&base=${currentScript.id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs border-border-strong text-subtle-foreground hover:text-foreground"
                                  title={`Compare with the current draft (v${currentScript.version}) and apply changes scene by scene`}
                                >
                                  Compare
                                </Button>
                              </Link>
                            )}

                            {!script.is_current && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isPending || !!mergingId}
                                title="Merge this draft's changes into the master script, highlighted for review"
                                onClick={() => (currentScript?.is_current ? handleMerge(script) : handleMakeCurrent(script.id))}
                                className="h-8 text-xs border-border text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                              >
                                {mergingId === script.id ? 'Merging…' : currentScript?.is_current ? 'Merge into Master' : 'Set as Master'}
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => setScriptToDelete(script)}
                              className="h-8 w-8 p-0 text-faint hover:text-red-700 dark:hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                              title="Delete Draft"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <ScriptUploadModal
        projectId={projectId}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        suggestedVersion={suggestedVersion}
        hasCurrentDraft={scripts.some((s) => s.is_current)}
      />

      {/* Accidental Deletion Modal */}
      {scriptToDelete && (
        <DeleteConfirmModal
          isOpen={Boolean(scriptToDelete)}
          onClose={() => setScriptToDelete(null)}
          onConfirm={handleDeleteScript}
          title={`Delete Script Draft: ${scriptToDelete.file_name}`}
          description={`Permanently remove version v${scriptToDelete.version} (${getRevisionColorMeta(scriptToDelete.revision_color).label}) and its file. Scenes are kept by default${
            deleteImpact?.isCurrent && deleteImpact.otherDraftCount > 0 ? ' and the previous draft becomes current' : ''
          }.`}
          itemName={scriptToDelete.file_name}
          itemType="screenplay file"
          isPending={isPending}
        >
          {deleteImpact && deleteImpact.sceneCount > 0 && (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/50 p-3 text-xs text-left">
              <p className="text-foreground">
                This draft owns {deleteImpact.sceneCount} scenes — {deleteImpact.scheduledSceneCount} scheduled,{' '}
                {deleteImpact.taggedElementCount} breakdown tags.
              </p>
              <label className="flex items-start gap-2 text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteScenesToo}
                  onChange={(e) => setDeleteScenesToo(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Also delete these scenes, their breakdown, and their schedule placement (cannot be undone)
                </span>
              </label>
            </div>
          )}
        </DeleteConfirmModal>
      )}
    </div>
  )
}

/** "1 Oct 2026" — fixed locale and time zone so the server and the browser render the same text */
function formatIssueDate(date: string) {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
