'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { ScriptSceneItem } from '@/features/scripts/actions'
import type { SceneBreakdownData, ProjectBreakdownStats } from '../actions'
import {
  getSceneBreakdownAction,
  getProjectBreakdownStatsAction,
  getOneLinerReportAction,
  syncBreakdownWithResourcesAction,
} from '../actions'
import { draftOneLinersAction, type OneLinerMode } from '../ai-actions'
import { ONE_LINER_BATCH_SIZE, formatEighths, sceneEighths, sceneTimeLabel } from '../lib/one-liners'
import { buildOneLinerRows, downloadOneLinerCsv, printOneLinerReport } from '../lib/one-liner-export'
import { SceneBreakdownCard } from './scene-breakdown-card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback-provider'
import { useDismiss } from '@/components/ui/use-dismiss'
import {
  Layers,
  Search,
  Users,
  Box,
  Flame,
  Sparkles,
  RefreshCw,
  Download,
  FileText,
  Table,
  ChevronDown,
  X,
} from 'lucide-react'

interface BreakdownHubProps {
  projectId: string
  projectName: string
  scenes: ScriptSceneItem[]
  initialSceneId?: string
}

export function BreakdownHub({ projectId, projectName, scenes: initialScenes, initialSceneId }: BreakdownHubProps) {
  const { notify, confirm } = useFeedback()
  // One-liners are edited here (AI drafts, hand edits), so the list keeps its own copy
  const [scenes, setScenes] = useState(initialScenes)
  const [scenesFromServer, setScenesFromServer] = useState(initialScenes)
  if (initialScenes !== scenesFromServer) {
    setScenesFromServer(initialScenes)
    setScenes(initialScenes)
  }
  const updateSynopsis = (sceneId: string, synopsis: string | null, source: 'AI' | 'USER' | null) =>
    setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, synopsis, synopsis_source: source } : s)))

  const [activeSceneId, setActiveSceneId] = useState<string>(
    initialSceneId || scenes[0]?.id || ''
  )
  const [breakdownData, setBreakdownData] = useState<SceneBreakdownData | null>(null)
  const [stats, setStats] = useState<ProjectBreakdownStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')

  // Fetch stats & active scene breakdown data
  const loadData = async (sceneId: string) => {
    if (!sceneId) return
    setIsLoading(true)

    const [breakdownRes, statsRes] = await Promise.all([
      getSceneBreakdownAction(sceneId),
      getProjectBreakdownStatsAction(projectId),
    ])

    setBreakdownData(breakdownRes)
    setStats(statsRes)
    setIsLoading(false)
  }

  // Bring existing breakdown data in line with Cast & Crew once per visit
  const [isSynced, setIsSynced] = useState(false)
  useEffect(() => {
    let cancelled = false
    syncBreakdownWithResourcesAction(projectId).finally(() => {
      if (!cancelled) setIsSynced(true)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    if (isSynced) loadData(activeSceneId)
  }, [activeSceneId, projectId, isSynced])

  // Filtered scenes list for left sidebar
  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) return scenes
    const q = searchQuery.toLowerCase()
    return scenes.filter((s) => {
      const numMatch = s.scene_number.toLowerCase().includes(q)
      const headingMatch = s.heading?.toLowerCase().includes(q)
      const locMatch = s.location_name?.toLowerCase().includes(q)
      const lineMatch = s.synopsis?.toLowerCase().includes(q)
      return numMatch || headingMatch || locMatch || lineMatch
    })
  }, [scenes, searchQuery])

  const activeSceneObj = useMemo(() => {
    return scenes.find((s) => s.id === activeSceneId) || scenes[0]
  }, [scenes, activeSceneId])

  // ---- One-liners: AI drafts (in small batches, with progress) ----
  const writtenCount = scenes.filter((s) => s.synopsis?.trim()).length
  const missingCount = scenes.length - writtenCount
  const aiDraftedCount = scenes.filter((s) => s.synopsis?.trim() && s.synopsis_source === 'AI').length
  const [drafting, setDrafting] = useState<{ done: number; total: number } | null>(null)
  const cancelDraftRef = useRef(false)

  const runDraft = async (mode: Extract<OneLinerMode, 'fill' | 'redraft'>) => {
    const targets = scenes.filter((s) => (mode === 'fill' ? !s.synopsis?.trim() : s.synopsis_source !== 'USER'))
    if (targets.length === 0) return
    if (
      mode === 'redraft' &&
      !(await confirm({
        title: 'Redraft one-liners with AI?',
        message: `AI will rewrite ${targets.length} one-liner(s). One-liners someone wrote or edited by hand are kept.`,
        confirmLabel: 'Redraft',
      }))
    )
      return

    cancelDraftRef.current = false
    setDrafting({ done: 0, total: targets.length })
    const batches: ScriptSceneItem[][] = []
    for (let i = 0; i < targets.length; i += ONE_LINER_BATCH_SIZE) batches.push(targets.slice(i, i + ONE_LINER_BATCH_SIZE))

    let done = 0
    let failure: string | null = null
    let next = 0
    // Two batches in flight: fast enough for a feature film, gentle on rate limits
    const worker = async () => {
      while (next < batches.length && !cancelDraftRef.current && !failure) {
        const batch = batches[next++]
        try {
          const res = await draftOneLinersAction(projectId, batch.map((s) => s.id), mode)
          res.drafted.forEach((d) => updateSynopsis(d.sceneId, d.synopsis, 'AI'))
          if (res.error) failure = res.error
        } catch {
          failure = 'Could not reach the server. Check your connection and try again.'
        }
        done += batch.length
        setDrafting({ done: Math.min(done, targets.length), total: targets.length })
      }
    }
    await Promise.all([worker(), worker()])
    setDrafting(null)

    if (failure) notify(failure, 'error')
    else if (cancelDraftRef.current) notify('Stopped. One-liners drafted so far are saved.', 'info')
    else notify(`AI drafted ${targets.length} one-liner(s). Review and edit them in each scene.`, 'success')
  }

  // ---- Export ----
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useDismiss(exportOpen, () => setExportOpen(false))
  const exportScenes = searchQuery.trim() ? filteredScenes : scenes

  const handleExport = async (format: 'pdf' | 'csv') => {
    setExportOpen(false)
    if (exportScenes.length === 0) return
    setExporting(true)
    try {
      const report = await getOneLinerReportAction(exportScenes.map((s) => s.id))
      const rows = buildOneLinerRows(exportScenes, report)
      if (format === 'csv') downloadOneLinerCsv(rows, report, projectName)
      else await printOneLinerReport(rows, report, projectName)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not build the one-liner report', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 w-full">
      {/* TOP PRODUCTION BREAKDOWN DASHBOARD STATS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Scenes */}
        <div className="bg-background border border-border p-3.5 rounded-xl shadow-md space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Total Scenes</span>
            <Layers className="size-3.5 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="text-xl font-mono font-bold text-foreground">
            {scenes.length}
          </div>
          <div className="text-[10px] font-mono text-faint">
            {stats?.confirmedScenes || 0} Breakdown Confirmed
          </div>
        </div>

        {/* Total Tagged Elements */}
        <div className="bg-background border border-border p-3.5 rounded-xl shadow-md space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Tagged Elements</span>
            <Box className="size-3.5 text-violet-700 dark:text-violet-400" />
          </div>
          <div className="text-xl font-mono font-bold text-violet-700 dark:text-violet-400">
            {stats?.totalElements || 0}
          </div>
          <div className="text-[10px] font-mono text-faint">
            {stats?.confirmedElements || 0} Confirmed Items
          </div>
        </div>

        {/* Cast & Extras */}
        <div className="bg-background border border-border p-3.5 rounded-xl shadow-md space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Cast & Extras</span>
            <Users className="size-3.5 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="text-xl font-mono font-bold text-amber-700 dark:text-amber-400">
            {(stats?.elementCountsByType?.CAST || 0) + (stats?.elementCountsByType?.EXTRA || 0)}
          </div>
          <div className="text-[10px] font-mono text-faint">
            Across {scenes.length} scenes
          </div>
        </div>

        {/* Stunts & VFX */}
        <div className="bg-background border border-border p-3.5 rounded-xl shadow-md space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Stunts & VFX</span>
            <Flame className="size-3.5 text-rose-700 dark:text-rose-400" />
          </div>
          <div className="text-xl font-mono font-bold text-rose-700 dark:text-rose-400">
            {(stats?.elementCountsByType?.STUNT || 0) + (stats?.elementCountsByType?.VFX || 0)}
          </div>
          <div className="text-[10px] font-mono text-faint">
            High production requirements
          </div>
        </div>
      </div>

      {/* ONE-LINERS: AI drafts + export */}
      <div className="bg-background border border-border rounded-xl px-3.5 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground min-w-0">
          <FileText className="size-3.5 text-amber-600 dark:text-amber-500 shrink-0" />
          {drafting ? (
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-foreground">
                AI drafting one-liners… {drafting.done}/{drafting.total}
              </span>
              <span className="hidden sm:block w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                <span
                  className="block h-full bg-amber-500 transition-all"
                  style={{ width: `${Math.round((drafting.done / Math.max(1, drafting.total)) * 100)}%` }}
                />
              </span>
            </span>
          ) : (
            <span>
              ONE-LINERS: <strong className="text-foreground">{writtenCount}</strong> / {scenes.length} written
              {aiDraftedCount > 0 && <span className="text-faint"> · {aiDraftedCount} AI drafts to review</span>}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {drafting ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (cancelDraftRef.current = true)}
              className="text-xs font-mono cursor-pointer"
            >
              <X className="size-3.5 mr-1" />
              Stop
            </Button>
          ) : missingCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runDraft('fill')}
              disabled={scenes.length === 0}
              className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-mono cursor-pointer"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              Draft {missingCount} with AI
            </Button>
          ) : aiDraftedCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runDraft('redraft')}
              className="text-xs font-mono cursor-pointer"
              title="Rewrite the AI drafts (hand-written one-liners are kept)"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              Redraft AI one-liners
            </Button>
          ) : null}

          <div ref={exportRef} className="relative">
            <Button
              type="button"
              size="sm"
              onClick={() => setExportOpen((o) => !o)}
              disabled={exporting || exportScenes.length === 0}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono cursor-pointer"
            >
              {exporting ? <RefreshCw className="size-3.5 mr-1.5 animate-spin" /> : <Download className="size-3.5 mr-1.5" />}
              Export one-liners
              <ChevronDown className="size-3.5 ml-1" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-30 w-60 rounded-lg border border-border bg-background shadow-xl p-1 text-xs font-mono">
                {searchQuery.trim() && (
                  <div className="px-2.5 py-1.5 text-faint">
                    {exportScenes.length} scene(s) matching &quot;{searchQuery}&quot;
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-left text-foreground cursor-pointer"
                >
                  <FileText className="size-3.5 text-rose-600 dark:text-rose-400" />
                  PDF (print / save as PDF)
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-muted text-left text-foreground cursor-pointer"
                >
                  <Table className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  CSV (Excel / Google Sheets)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN BREAKDOWN SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: SCENE SELECTOR */}
        <div className="lg:col-span-4 xl:col-span-3 bg-background border border-border rounded-2xl p-3.5 shadow-lg space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-subtle-foreground">
              SCENE BREAKDOWN LIST ({scenes.length})
            </div>
            <button
              type="button"
              onClick={() => loadData(activeSceneId)}
              className="p-1 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
              title="Refresh breakdown data"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin text-amber-600 dark:text-amber-500' : ''}`} />
            </button>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-faint" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scene #, location or one-liner..."
              className="pl-8 bg-card border-border text-xs h-8 text-foreground placeholder:text-faint"
            />
          </div>

          {/* Scenes List */}
          <div className="max-h-[750px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {filteredScenes.length === 0 ? (
              <div className="p-8 text-center text-faint text-xs font-mono">
                No scenes matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredScenes.map((s) => {
                const isSelected = activeSceneObj?.id === s.id
                const isConfirmed = s.status === 'CONFIRMED' || s.status === 'LOCKED'

                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveSceneId(s.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 shadow-md ring-1 ring-amber-500/30'
                        : 'border-border/80 bg-card/60 hover:bg-card hover:border-border-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-mono text-xs font-bold ${isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-amber-600 dark:text-amber-500'}`}>
                        SCENE {s.scene_number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {s.int_ext && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background border border-border text-muted-foreground">
                            {s.int_ext === 'INT_EXT' ? 'I/E' : s.int_ext}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                            isConfirmed
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-background border-border text-muted-foreground'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-between gap-2">
                      <span className="truncate" title={s.location_name || ''}>
                        {s.location_name || 'N/A'}
                        {sceneTimeLabel(s) && <span className="text-faint"> · {sceneTimeLabel(s)}</span>}
                      </span>
                      <span className="shrink-0">
                        {formatEighths(sceneEighths(s).eighths)} pg · p{s.page_start || 1}
                      </span>
                    </div>

                    {/* The one-liner: what happens in the scene */}
                    <div className="pt-1.5 border-t border-border/50">
                      {s.synopsis?.trim() ? (
                        <div className="text-[13px] font-semibold leading-snug text-foreground line-clamp-2" title={s.synopsis}>
                          {s.synopsis}
                        </div>
                      ) : (
                        <div className="text-xs italic text-faint">No one-liner yet</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE SCENE BREAKDOWN SHEET */}
        <div className="lg:col-span-8 xl:col-span-9">
          {isLoading && !breakdownData ? (
            <div className="p-16 text-center text-muted-foreground font-mono text-xs border border-border rounded-2xl bg-background space-y-3">
              <RefreshCw className="size-6 animate-spin text-amber-600 dark:text-amber-500 mx-auto" />
              <p>Loading Scene Breakdown Data...</p>
            </div>
          ) : breakdownData ? (
            <SceneBreakdownCard
              data={breakdownData}
              projectId={projectId}
              onRefresh={() => loadData(activeSceneId)}
              onSynopsisChange={updateSynopsis}
            />
          ) : (
            <div className="p-16 text-center text-faint font-mono text-xs border border-border rounded-2xl bg-background">
              Select a scene from the list to view its breakdown sheet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
