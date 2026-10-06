'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type {
  ScriptDocumentWithStats,
  ScriptSceneItem,
  ScriptPageItem,
} from '@/features/scripts/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  ArrowLeft,
  FileText,
  Search,
  Layers,
  BookOpen,
  GitCompare,
  Sun,
  Moon,
  Sunset,
  Sunrise,
  Clock,
  Compass,
  MapPin,
  Sparkles,
  Eye,
  Plus,
} from 'lucide-react'
import { ScreenplayReader } from './screenplay-reader'
import { AddSceneModal } from './add-scene-modal'
import { DraftCompareView } from './draft-compare-view'
import { sceneMatchScore } from '@/features/scheduling/lib/scene-search'
import { useProjectTitleSuffix } from '@/features/projects/components/project-title'

interface ScriptDetailViewProps {
  projectId: string
  script: ScriptDocumentWithStats
  scenes: ScriptSceneItem[]
  pages: ScriptPageItem[]
  /** All drafts of the project, for comparing */
  drafts: ScriptDocumentWithStats[]
  initialTab?: 'SCENES' | 'READER' | 'COMPARE'
  /** Draft to compare against (?base=…) */
  compareBaseId?: string
  /** Not the current draft: scenes are read from the file and cannot be edited */
  readOnly?: boolean
}

export function ScriptDetailView({
  projectId,
  script,
  scenes,
  pages,
  drafts,
  initialTab = 'SCENES',
  compareBaseId,
  readOnly = false,
}: ScriptDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'SCENES' | 'READER' | 'COMPARE'>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [intExtFilter, setIntExtFilter] = useState<'ALL' | 'INT' | 'EXT' | 'INT_EXT'>('ALL')
  const [activePageNum, setActivePageNum] = useState<number>(1)
  const [scenesList, setScenesList] = useState<ScriptSceneItem[]>(scenes)
  const [isAddSceneOpen, setIsAddSceneOpen] = useState(false)

  React.useEffect(() => {
    setScenesList(scenes)
  }, [scenes])

  useProjectTitleSuffix(script.file_name)
  const currentDraft = drafts.find((d) => d.is_current && d.id !== script.id)
  const isNewerThanCurrent =
    !!currentDraft &&
    (script.version > currentDraft.version || (script.version === currentDraft.version && script.created_at > currentDraft.created_at))
  const draftVersions = React.useMemo(() => Object.fromEntries(drafts.map((d) => [d.id, d.version])), [drafts])
  /** "v3" when a scene still has an older draft's text (its changes not applied yet) */
  const olderDraftOf = (scene: ScriptSceneItem) =>
    scene.script_document_id && scene.script_document_id !== script.id && draftVersions[scene.script_document_id]
      ? `v${draftVersions[scene.script_document_id]}`
      : null

  // Next suggested scene number
  const nextSuggestedNumber = React.useMemo(() => {
    const nums = scenesList
      .map((s) => parseInt(s.scene_number.replace(/\D/g, '')))
      .filter((n) => !isNaN(n))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    return String(max + 1)
  }, [scenesList])

  // Filter scenes
  const filteredScenes = scenesList.filter((scene) => {
    if (intExtFilter !== 'ALL' && scene.int_ext !== intExtFilter) {
      return false
    }
    return sceneMatchScore(scene, searchQuery) > 0
  })

  const [selectedSceneNumber, setSelectedSceneNumber] = useState<string | undefined>(
    scenesList[0]?.scene_number
  )

  const handleReadScene = (sceneNum: string) => {
    setSelectedSceneNumber(sceneNum)
    setActiveTab('READER')
  }

  const handleSceneCreated = (newScene: ScriptSceneItem) => {
    setScenesList((prev) => [...prev, newScene])
    setSelectedSceneNumber(newScene.scene_number)
  }

  return (
    <div className="space-y-4 w-full">
      {/* Header: the file name sits next to the project name in the project header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          href={`/projects/${projectId}/scripts`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Screenplay Hub
        </Link>

        {readOnly && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200 sm:order-none">
            <span>
              {isNewerThanCurrent
                ? `v${script.version} is not applied yet — the app still follows ${currentDraft ? `v${currentDraft.version}` : 'another draft'}.`
                : `A past draft${currentDraft ? ` (the app follows v${currentDraft.version})` : ''}.`}{' '}
              Read only.
            </span>
            {activeTab !== 'COMPARE' && currentDraft && (
              <button
                type="button"
                onClick={() => setActiveTab('COMPARE')}
                className="font-semibold underline underline-offset-2 hover:no-underline cursor-pointer"
              >
                {isNewerThanCurrent ? 'Review changes & apply' : `Compare with v${currentDraft.version}`}
              </button>
            )}
          </div>
        )}

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('SCENES')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'SCENES'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="size-3.5" />
              <span>Extracted Scenes ({scenes.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('READER')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'READER'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="size-3.5" />
              <span>Script Reader ({pages.length}p)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('COMPARE')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'COMPARE'
                  ? 'bg-amber-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <GitCompare className="size-3.5" />
              <span>Compare Drafts</span>
            </button>
          </div>
      </div>

      {/* VIEW 1: EXTRACTED SCENES BREAKDOWN */}
      {activeTab === 'SCENES' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-faint" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scenes by slugline, location, or scene number..."
                className="pl-9 bg-card/60 border-border text-xs h-10 text-foreground placeholder:text-faint"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-faint">Filter INT/EXT:</span>
              <div className="flex items-center gap-1 bg-card/80 border border-border p-1 rounded-lg">
                {(['ALL', 'INT', 'EXT', 'INT_EXT'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setIntExtFilter(filter)}
                    className={`px-2.5 py-1 text-[11px] font-mono rounded transition-all cursor-pointer ${
                      intExtFilter === filter
                        ? 'bg-muted text-foreground font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter === 'ALL' ? 'All' : filter === 'INT_EXT' ? 'I/E' : filter}
                  </button>
                ))}
              </div>

              {!readOnly && (
                <Button
                  type="button"
                  onClick={() => setIsAddSceneOpen(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs h-8 px-3 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="size-3.5" />
                  <span>Add Scene</span>
                </Button>
              )}
            </div>
          </div>

          {/* Scenes Grid */}
          {filteredScenes.length === 0 ? (
            <Card className="border-dashed border-border bg-background/40 p-8 text-center">
              <p className="text-xs text-muted-foreground">
                No scenes match your current filter criteria.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {filteredScenes.map((scene) => {
                const isNight = scene.time_of_day === 'NIGHT' || scene.time_of_day === 'DUSK'
                const isDay = scene.time_of_day === 'DAY' || scene.time_of_day === 'DAWN'

                return (
                  <Card
                    key={scene.id}
                    className="border-border bg-card/60 hover:border-border-strong transition-all flex flex-col justify-between group shadow-lg"
                  >
                    <CardHeader className="p-4 pb-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        {/* Scene Number */}
                        <span className="px-2 py-0.5 rounded bg-muted border border-border-strong text-amber-700 dark:text-amber-400 font-mono font-bold text-xs">
                          SCENE {scene.scene_number}
                          {olderDraftOf(scene) && (
                            <span
                              className="ml-1.5 font-normal text-[10px] text-amber-800 dark:text-amber-300"
                              title="This scene still has an older draft's text — apply its changes in Compare Drafts"
                            >
                              · {olderDraftOf(scene)} text
                            </span>
                          )}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* INT/EXT Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono font-semibold ${
                              scene.int_ext === 'INT'
                                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30'
                                : scene.int_ext === 'EXT'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {scene.int_ext || 'INT'}
                          </Badge>

                          {/* Time of Day */}
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono flex items-center gap-1 ${
                              isNight
                                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                                : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {isNight ? <Moon className="size-2.5" /> : <Sun className="size-2.5" />}
                            <span>{scene.time_of_day || 'DAY'}</span>
                          </Badge>
                        </div>
                      </div>

                      {/* Location Name */}
                      <CardTitle className="text-sm font-bold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors line-clamp-1 flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{scene.location_name || 'UNSPECIFIED LOCATION'}</span>
                      </CardTitle>

                      {/* Slugline / Heading */}
                      <div className="text-[11px] font-mono text-muted-foreground truncate bg-background/80 px-2 py-1 rounded border border-border/80">
                        {scene.heading}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-2 space-y-3">
                      {/* One-liner, falling back to the opening of the scene text */}
                      {scene.synopsis?.trim() ? (
                        <p className="text-xs text-foreground line-clamp-2 leading-relaxed" title={scene.synopsis}>
                          {scene.synopsis}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {scene.description || 'No action summary available.'}
                        </p>
                      )}

                      {/* Footer Info */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-faint font-mono">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <BookOpen className="size-3" />
                            <span>Page {scene.page_start}</span>
                          </span>

                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="size-3 text-amber-700 dark:text-amber-400" />
                            <span>Est. {Math.round((scene.estimated_duration || 60) / 60)}m</span>
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleReadScene(scene.scene_number)}
                          className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer hover:underline transition-colors"
                        >
                          <Eye className="size-3" />
                          <span>Read Script</span>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SCRIPT READER WITH SCENE NAVIGATOR */}
      {activeTab === 'READER' && (
        <ScreenplayReader
          script={script}
          scenes={scenesList}
          pages={pages}
          initialSceneNumber={selectedSceneNumber}
          draftVersions={draftVersions}
          readOnly={readOnly}
        />
      )}

      {/* VIEW 3: TWO DRAFTS SIDE BY SIDE */}
      {activeTab === 'COMPARE' && (
        <DraftCompareView
          projectId={projectId}
          drafts={drafts}
          scriptId={script.id}
          initialBaseId={compareBaseId ?? (readOnly ? currentDraft?.id : undefined)}
        />
      )}

      {/* Add Scene Modal */}
      <AddSceneModal
        isOpen={isAddSceneOpen}
        onClose={() => setIsAddSceneOpen(false)}
        projectId={projectId}
        scriptId={script.id}
        nextSuggestedNumber={nextSuggestedNumber}
        onSceneCreated={handleSceneCreated}
      />
    </div>
  )
}
