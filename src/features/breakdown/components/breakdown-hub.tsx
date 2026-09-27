'use client'

import React, { useState, useEffect, useMemo } from 'react'
import type { Database } from '@/types/database'
import type { ScriptSceneItem } from '@/features/scripts/actions'
import type { SceneBreakdownData, ProjectBreakdownStats } from '../actions'
import {
  getSceneBreakdownAction,
  getProjectBreakdownStatsAction,
  syncBreakdownWithResourcesAction,
} from '../actions'
import { SceneBreakdownCard } from './scene-breakdown-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Users,
  Box,
  Car,
  Flame,
  Sparkles,
  RefreshCw,
  Filter,
} from 'lucide-react'

interface BreakdownHubProps {
  projectId: string
  scenes: ScriptSceneItem[]
  initialSceneId?: string
}

export function BreakdownHub({ projectId, scenes, initialSceneId }: BreakdownHubProps) {
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
      return numMatch || headingMatch || locMatch
    })
  }, [scenes, searchQuery])

  const activeSceneObj = useMemo(() => {
    return scenes.find((s) => s.id === activeSceneId) || scenes[0]
  }, [scenes, activeSceneId])

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
              placeholder="Search scene # or heading..."
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
                            {s.int_ext}
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

                    <div className="font-mono text-xs font-semibold text-foreground truncate">
                      {s.heading || 'UNTITLED SCENE'}
                    </div>

                    <div className="text-[10px] font-mono text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                      <span>{s.location_name || 'N/A'}</span>
                      <span>Page {s.page_start || 1}</span>
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
