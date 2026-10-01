'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { logActivityAction } from '@/features/collaboration/actions'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { Database } from '@/types/database'
import type { ScriptSceneItem } from '@/features/scripts/actions'
import type { ProjectScheduleData, ShootDayWithScenes } from '../actions'
import {
  getProjectScheduleAction,
  createShootDayAction,
  updateShootDayAction,
  deleteShootDayAction,
  assignSceneToDayAction,
  removeSceneFromDayAction,
  reorderDayScenesAction,
} from '../actions'
import {
  detectScheduleConflicts,
  type ScheduleConflict,
  type QuickFixAction,
} from '../lib/conflict-detector'
import { ShootDayColumn } from './shoot-day-column'
import { StripboardStrip } from './stripboard-strip'
import {
  daySearchText,
  matchesIntExt,
  searchScenesDetailed,
  type SceneMatch,
  type SceneSearchExtras,
} from '../lib/scene-search'
import { loadSceneSearchIndex } from '../lib/scene-search-index'
import { loadScheduleConstraints } from '../lib/schedule-constraints'
import { detectAvailabilityConflicts, EMPTY_CONSTRAINTS, type ScheduleConstraints } from '../lib/availability-conflicts'
import { ScheduleFixModal, type FixRequest } from './schedule-fix-modal'
import { createClient } from '@/lib/supabase/client'
import { AssignScenePicker } from './assign-scene-picker'
import { useFeedback } from '@/components/ui/feedback-provider'
import { AutoScheduleModal } from './auto-schedule-modal'
import { loadAutoScheduleContext, removeEmptyDays } from '../lib/auto-schedule-run'
import { ConflictInspectorModal } from './conflict-inspector-modal'
import { ScheduleVersionSwitcher } from '@/features/versioning/components/version-switcher'
import { AiAnalysisModal } from '@/features/ai/components/ai-analysis-modal'
import { AiProposalsModal } from '@/features/ai/components/ai-proposals-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Plus,
  Wand2,
  RefreshCw,
  Search,
  Layers,
  FileText,
  CheckCircle2,
  Film,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Crosshair,
  ChevronDown,
  EyeOff,
  Trash2,
  Loader2,
} from 'lucide-react'

interface ScheduleBoardProps {
  projectId: string
  scenes: ScriptSceneItem[]
}

type SceneRow = Database['public']['Tables']['scenes']['Row']
type SceneScope = 'UNSCHEDULED' | 'SCHEDULED' | 'ALL'

/** A scheduled scene plus where it sits, for search results. */
interface PlacedScene {
  scene: SceneRow
  day: ShootDayWithScenes
}

const dayLabel = (d: ShootDayWithScenes) =>
  `Day ${d.day_number} · ${new Date(`${d.shoot_date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })}`

interface UnscheduledPoolSectionProps {
  filteredUnscheduledPool: SceneRow[]
  filteredScheduled: PlacedScene[]
  scope: SceneScope
  setScope: (val: SceneScope) => void
  onLocateScene: (sceneId: string, dayId: string) => void
  hiddenByFilterCount: number
  matchById: Map<string, SceneMatch>
  totalUnscheduledCount: number
  poolSearch: string
  setPoolSearch: (val: string) => void
  intExtFilter: 'ALL' | 'INT' | 'EXT'
  setIntExtFilter: (val: 'ALL' | 'INT' | 'EXT') => void
  shootDays: ShootDayWithScenes[]
  onAssignSceneToDay: (sceneId: string, dayId: string) => void
}

/** "Matched in Dialogue & action: …where is the ring…" — shown inside a strip. */
function MatchNote({ match }: { match?: SceneMatch }) {
  if (!match?.matchedIn) return null
  return (
    <span title={match.snippet || undefined}>
      <span className="font-semibold">{match.matchedIn}</span>
      {match.snippet ? <>: <span className="italic">{match.snippet}</span></> : null}
    </span>
  )
}

/** Scheduled scenes matching the search: jump to their day, or move them to another day. */
function ScheduledResults({
  matchById,
  results,
  shootDays,
  hasQuery,
  onLocate,
  onMove,
}: {
  matchById: Map<string, SceneMatch>
  results: PlacedScene[]
  shootDays: ShootDayWithScenes[]
  hasQuery: boolean
  onLocate: (sceneId: string, dayId: string) => void
  onMove: (sceneId: string, dayId: string) => void
}) {
  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
        {hasQuery
          ? 'No scheduled scene matches. Try a scene number (e.g. 8), a location, or a word from the heading.'
          : 'No scenes are scheduled yet.'}
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {results.map(({ scene, day }) => {
        const match = matchById.get(scene.id)
        return (
          <li key={scene.id}>
            <StripboardStrip
              scene={scene}
              isUnscheduledPool
              isSearchResult
              assignLabel="Move"
              assignOptions={[
                ...shootDays
                  .filter((d) => d.id !== day.id)
                  .map((d) => ({ id: d.id, label: `${dayLabel(d)} (${d.scenes.length} sc)` })),
                { id: '__pool__', label: 'Back to unscheduled pool' },
              ]}
              onAssign={(dayId) => onMove(scene.id, dayId)}
              note={
                <span className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => onLocate(scene.id, day.id)}
                    className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/15 hover:bg-black/25 font-semibold cursor-pointer"
                    title="Show this scene on the board"
                  >
                    <Crosshair className="size-3" />
                    {dayLabel(day)}
                  </button>
                  {match?.matchedIn && (
                    <span className="truncate">
                      <MatchNote match={match} />
                    </span>
                  )}
                </span>
              }
            />
          </li>
        )
      })}
    </ul>
  )
}

function UnscheduledPoolSection({
  filteredUnscheduledPool,
  filteredScheduled,
  scope,
  setScope,
  onLocateScene,
  hiddenByFilterCount,
  matchById,
  totalUnscheduledCount,
  poolSearch,
  setPoolSearch,
  intExtFilter,
  setIntExtFilter,
  shootDays,
  onAssignSceneToDay,
}: UnscheduledPoolSectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled-pool',
    data: {
      type: 'pool',
    },
  })

  const sceneIds = useMemo(() => filteredUnscheduledPool.map((s) => s.id), [filteredUnscheduledPool])
  const assignOptions = useMemo(
    () => shootDays.map((d) => ({ id: d.id, label: `${dayLabel(d)} (${d.scenes.length} sc)` })),
    [shootDays]
  )

  return (
    <div
      ref={setNodeRef}
      className={`lg:col-span-4 bg-background border rounded-2xl p-4 shadow-xl space-y-4 transition-colors ${
        isOver
          ? 'border-amber-400 bg-amber-950/20 ring-2 ring-amber-500/40'
          : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-subtle-foreground flex items-center gap-1.5">
          <Film className="size-3.5 text-amber-600 dark:text-amber-500" />
          <span>{scope === 'UNSCHEDULED' ? `Unscheduled pool (${filteredUnscheduledPool.length})` : 'Find scene'}</span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono border-border text-muted-foreground">
          {totalUnscheduledCount} unscheduled
        </Badge>
      </div>

      {/* Search (left) + filters (right) on one row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-faint" />
          <Input
            value={poolSearch}
            onChange={(e) => setPoolSearch(e.target.value)}
            onKeyDown={(e) => {
              // Enter jumps to the first scheduled match
              if (e.key === 'Enter' && scope !== 'UNSCHEDULED' && filteredScheduled[0]) {
                onLocateScene(filteredScheduled[0].scene.id, filteredScheduled[0].day.id)
              }
            }}
            placeholder="Search anything…"
            title="Scene #, dialogue, cast, props, location, tags, notes, or a day (day 3, 20/09). Enter jumps to the first scheduled match. Double-click a strip for details."
            aria-label="Search scenes"
            className="pl-8 bg-card border-border text-xs h-8 text-foreground placeholder:text-faint"
          />
        </div>

        <div className="relative shrink-0">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as SceneScope)}
            aria-label="Which scenes to show"
            className={`h-8 pl-2 pr-6 rounded-lg border bg-card text-xs font-medium text-foreground cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none ${scope !== 'UNSCHEDULED' ? 'border-amber-500/60' : 'border-border'}`}
          >
            <option value="UNSCHEDULED">Unscheduled ({totalUnscheduledCount})</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="ALL">All scenes</option>
          </select>
          <ChevronDown className="size-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
        </div>

        <div className="relative shrink-0">
          <select
            value={intExtFilter}
            onChange={(e) => setIntExtFilter(e.target.value as 'ALL' | 'INT' | 'EXT')}
            aria-label="Interior or exterior"
            className={`h-8 pl-2 pr-6 rounded-lg border bg-card text-xs font-medium text-foreground cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none ${intExtFilter !== 'ALL' ? 'border-amber-500/60' : 'border-border'}`}
          >
            <option value="ALL">INT + EXT</option>
            <option value="INT">INT only</option>
            <option value="EXT">EXT only</option>
          </select>
          <ChevronDown className="size-3.5 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
        </div>
      </div>

      {hiddenByFilterCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          <span>
            {hiddenByFilterCount} more match{hiddenByFilterCount === 1 ? '' : 'es'} hidden by the {intExtFilter} filter.
          </span>
          <button
            type="button"
            onClick={() => setIntExtFilter('ALL')}
            className="font-semibold underline underline-offset-2 cursor-pointer shrink-0"
          >
            Show all
          </button>
        </div>
      )}

      {/* Unscheduled Strips List */}
      <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
        <div className="max-h-[700px] overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[150px]">
          {scope === 'ALL' && filteredScheduled.length === 0 && filteredUnscheduledPool.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
              {poolSearch.trim()
                ? `No scene matches “${poolSearch}”. Try a scene number (e.g. 8), a location, or a word from the heading.`
                : 'No scenes yet.'}
            </div>
          ) : scope === 'ALL' && filteredScheduled.length === 0 ? null : scope !== 'UNSCHEDULED' && (
            <ScheduledResults
              matchById={matchById}
              results={filteredScheduled}
              shootDays={shootDays}
              hasQuery={poolSearch.trim().length > 0}
              onLocate={onLocateScene}
              onMove={onAssignSceneToDay}
            />
          )}
          {scope === 'SCHEDULED' ? null : scope === 'ALL' && filteredUnscheduledPool.length > 0 ? (
            <div className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unscheduled</div>
          ) : null}
          {scope === 'SCHEDULED' ? null : filteredUnscheduledPool.length === 0 ? (
            scope === 'ALL' ? null : poolSearch.trim() ? (
              <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl space-y-2">
                <p>No unscheduled scene matches “{poolSearch}”.</p>
                {filteredScheduled.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setScope('ALL')}
                    className="text-amber-700 dark:text-amber-400 font-medium hover:underline cursor-pointer"
                  >
                    {filteredScheduled.length} scheduled scene{filteredScheduled.length === 1 ? '' : 's'} match — show them
                  </button>
                )}
              </div>
            ) : (
            <div className="p-8 text-center text-faint text-xs font-mono border border-dashed border-border rounded-xl space-y-1">
              <CheckCircle2 className="size-6 mx-auto text-emerald-600 dark:text-emerald-500" />
              <p>No unscheduled scenes in pool.</p>
              <p className="text-[10px] text-faint">All scenes are scheduled on production shoot days!</p>
            </div>
            )
          ) : (
            filteredUnscheduledPool.map((scene) => (
              <div key={scene.id}>
                <StripboardStrip
                  scene={scene}
                  isUnscheduledPool
                  sourceDayId="unscheduled"
                  assignOptions={assignOptions}
                  onAssign={(dayId) => onAssignSceneToDay(scene.id, dayId)}
                  note={matchById.get(scene.id)?.matchedIn ? <MatchNote match={matchById.get(scene.id)} /> : undefined}
                />
              </div>
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

export function ScheduleBoard({ projectId, scenes }: ScheduleBoardProps) {
  const [scheduleData, setScheduleData] = useState<ProjectScheduleData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingDay, setIsCreatingDay] = useState(false)
  const [isAutoScheduleOpen, setIsAutoScheduleOpen] = useState(false)
  const [isDeletingEmpty, setIsDeletingEmpty] = useState(false)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false)
  const [activeScene, setActiveScene] = useState<Database['public']['Tables']['scenes']['Row'] | null>(null)
  const [pickerDayId, setPickerDayId] = useState<string | null>(null)
  const [scope, setScope] = useState<SceneScope>('UNSCHEDULED')
  const [hideEmptyDays, setHideEmptyDays] = useState(false)
  const [searchIndex, setSearchIndex] = useState<Map<string, SceneSearchExtras>>(new Map())
  const [constraints, setConstraints] = useState<ScheduleConstraints>(EMPTY_CONSTRAINTS)
  const [fixRequest, setFixRequest] = useState<FixRequest | null>(null)
  const { confirm, notify } = useFeedback()

  // Search & Filters for Unscheduled Pool
  const [poolSearch, setPoolSearch] = useState('')
  const [intExtFilter, setIntExtFilter] = useState<'ALL' | 'INT' | 'EXT'>('ALL')

  // Setup sensors with activation constraint so button clicks are preserved
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Load Schedule Data
  const loadSchedule = async () => {
    // Breakdown text (cast, props, tags, notes) so search can find anything in a scene
    loadSceneSearchIndex(createClient(), projectId).then(setSearchIndex)
    setIsLoading(true)
    const res = await getProjectScheduleAction(projectId)
    setScheduleData(res)
    // Availability, scene needs, booking times, location hours → time-aware conflicts
    loadScheduleConstraints(
      createClient(),
      projectId,
      // scheduled + unscheduled, so suggestions can check pool scenes too
      [...res.shootDays.flatMap((d) => d.scenes.map((s) => s.scene.id)), ...res.unscheduledScenes.map((s) => s.id)],
      res.shootDays.map((d) => d.id)
    ).then(setConstraints)
    setIsLoading(false)
  }

  useEffect(() => {
    loadSchedule()
  }, [projectId])

  // Real-time schedule conflict engine evaluation
  const { conflicts, timelines } = useMemo(() => {
    if (!scheduleData) return { conflicts: [], timelines: new Map() }
    const timed = detectAvailabilityConflicts(scheduleData.shootDays, constraints)
    return {
      conflicts: [...timed.conflicts, ...detectScheduleConflicts(scheduleData.shootDays, scheduleData.unscheduledScenes)],
      timelines: timed.timelines,
    }
  }, [scheduleData, constraints])

  // Quick Fix Handler
  const handleApplyQuickFix = async (fix: QuickFixAction) => {
    if (fix.actionType === 'ADJUST_CALL_TIME' && fix.suggestedCallTime) {
      await updateShootDayAction(fix.dayId, { callTime: fix.suggestedCallTime })
    } else if (fix.actionType === 'DELETE_DAY') {
      const ok = await confirm({
        title: 'Delete this empty shoot day?',
        confirmLabel: 'Delete day',
        destructive: true,
      })
      if (!ok) return
      await deleteShootDayAction(fix.dayId)
    }
    loadSchedule()
  }

  // Create Shoot Day Handler
  const handleAddShootDay = async () => {
    setIsCreatingDay(true)
    // Next free date: the day after the last shoot day (dates are unique per production)
    const used = new Set((scheduleData?.shootDays || []).map((d) => d.shoot_date))
    const last = Array.from(used).sort().pop()
    const next = new Date(`${last || new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    if (last) next.setUTCDate(next.getUTCDate() + 1)
    while (used.has(next.toISOString().slice(0, 10))) next.setUTCDate(next.getUTCDate() + 1)
    const res = await createShootDayAction(projectId, next.toISOString().slice(0, 10))
    setIsCreatingDay(false)
    if (!res.success) notify(res.error || 'Could not add a shoot day', 'error')
    else logActivityAction(projectId, 'SHOOT_DAY_ADDED', `Added Day ${res.shootDay?.day_number ?? ''}`, res.shootDay?.shoot_date)
    loadSchedule()
  }

  // Delete every empty day at once (days with a call sheet, locked or started days are kept)
  const handleDeleteEmptyDays = async () => {
    if (!scheduleData) return
    setIsDeletingEmpty(true)
    try {
      const ctx = await loadAutoScheduleContext(projectId, scheduleData)
      const protectedCount = emptyDayCount - ctx.emptyDayIds.length
      if (ctx.emptyDayIds.length === 0) {
        notify('These empty days have a call sheet, are locked, or have started, so they were kept.', 'info')
        return
      }
      const ok = await confirm({
        title: `Delete ${ctx.emptyDayIds.length} empty shoot days?`,
        message: [
          protectedCount > 0 ? `${protectedCount} empty day(s) with a call sheet, a lock, or shooting started are kept.` : null,
          ctx.numbersFixed ? null : 'Remaining days are renumbered in date order.',
          'The current schedule is saved as a version first, so you can restore it.',
        ]
          .filter(Boolean)
          .join('\n'),
        confirmLabel: 'Delete empty days',
        destructive: true,
      })
      if (!ok) return
      const res = await removeEmptyDays(projectId, ctx)
      if (!res.success) notify(res.error || 'Could not delete the empty days', 'error')
      else {
        notify(`Deleted ${ctx.emptyDayIds.length} empty days. A backup version was saved.`, 'success')
        setHideEmptyDays(false)
      }
    } catch {
      notify('Could not delete the empty days. Please try again.', 'error')
    } finally {
      setIsDeletingEmpty(false)
      loadSchedule()
    }
  }

  // Assign Unscheduled Scene to Day
  const handleAssignSceneToDay = async (sceneId: string, dayId: string) => {
    if (dayId === '__pool__') {
      const from = scheduleData?.shootDays.find((d) => d.scenes.some((s) => s.scene.id === sceneId))
      if (from) {
        const res = await removeSceneFromDayAction(from.id, sceneId)
        if (!res.success) notify(res.error || 'Could not unschedule the scene', 'error')
      }
      loadSchedule()
      return
    }
    // Append to the end of the day rather than jumping to the top
    const day = scheduleData?.shootDays.find((d) => d.id === dayId)
    const res = await assignSceneToDayAction(dayId, sceneId, (day?.scenes.length || 0) + 1)
    if (!res.success) notify(res.error || 'Could not add the scene', 'error')
    loadSchedule()
  }

  // Drag & Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const activeSceneData = active.data.current?.scene as Database['public']['Tables']['scenes']['Row'] | undefined
    if (activeSceneData) {
      setActiveScene(activeSceneData)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveScene(null)

    if (!over || !scheduleData) return

    const activeSceneId = active.id as string
    const sourceDayId = active.data.current?.sourceDayId as string | undefined
    const overId = over.id as string

    // Determine target container (day ID or 'unscheduled-pool' or scene ID inside a day/pool)
    let targetContainerId: string | null = null

    if (overId === 'unscheduled-pool') {
      targetContainerId = 'unscheduled-pool'
    } else {
      const targetDay = scheduleData.shootDays.find((d) => d.id === overId)
      if (targetDay) {
        targetContainerId = targetDay.id
      } else {
        const dayContainingScene = scheduleData.shootDays.find((d) =>
          d.scenes.some((s) => s.scene.id === overId)
        )
        if (dayContainingScene) {
          targetContainerId = dayContainingScene.id
        } else if (scheduleData.unscheduledScenes.some((s) => s.id === overId)) {
          targetContainerId = 'unscheduled-pool'
        }
      }
    }

    if (!targetContainerId) return

    // Case 1: Drop onto Unscheduled Pool (from a Shoot Day)
    if (targetContainerId === 'unscheduled-pool') {
      if (sourceDayId && sourceDayId !== 'unscheduled') {
        setScheduleData((prev) => {
          if (!prev) return prev
          const sourceDay = prev.shootDays.find((d) => d.id === sourceDayId)
          const sceneItem = sourceDay?.scenes.find((s) => s.scene.id === activeSceneId)
          if (!sceneItem) return prev

          return {
            ...prev,
            shootDays: prev.shootDays.map((d) =>
              d.id === sourceDayId
                ? { ...d, scenes: d.scenes.filter((s) => s.scene.id !== activeSceneId) }
                : d
            ),
            unscheduledScenes: [...prev.unscheduledScenes, sceneItem.scene],
          }
        })

        await removeSceneFromDayAction(sourceDayId, activeSceneId)
        loadSchedule()
      }
      return
    }

    // Case 2: Move to a Shoot Day (from pool or another day)
    if (targetContainerId !== sourceDayId) {
      setScheduleData((prev) => {
        if (!prev) return prev
        let movedScene: Database['public']['Tables']['scenes']['Row'] | undefined

        if (sourceDayId === 'unscheduled') {
          movedScene = prev.unscheduledScenes.find((s) => s.id === activeSceneId)
        } else {
          const srcDay = prev.shootDays.find((d) => d.id === sourceDayId)
          movedScene = srcDay?.scenes.find((s) => s.scene.id === activeSceneId)?.scene
        }

        if (!movedScene) return prev

        const updatedUnscheduled = prev.unscheduledScenes.filter((s) => s.id !== activeSceneId)
        const updatedShootDays = prev.shootDays.map((d) => {
          if (d.id === sourceDayId) {
            return {
              ...d,
              scenes: d.scenes.filter((s) => s.scene.id !== activeSceneId),
            }
          }
          if (d.id === targetContainerId) {
            return {
              ...d,
              scenes: [
                ...d.scenes,
                {
                  assignmentId: `temp-${Date.now()}`,
                  scene: movedScene!,
                  sortOrder: d.scenes.length + 1,
                  estimatedMinutes: movedScene!.estimated_duration || 30,
                },
              ],
            }
          }
          return d
        })

        return {
          ...prev,
          unscheduledScenes: updatedUnscheduled,
          shootDays: updatedShootDays,
        }
      })

      await assignSceneToDayAction(targetContainerId, activeSceneId)
      loadSchedule()
      return
    }

    // Case 3: Re-order within the same Shoot Day
    if (targetContainerId === sourceDayId && sourceDayId !== 'unscheduled') {
      const day = scheduleData.shootDays.find((d) => d.id === sourceDayId)
      if (day) {
        const oldIndex = day.scenes.findIndex((s) => s.scene.id === activeSceneId)
        const newIndex = day.scenes.findIndex((s) => s.scene.id === overId)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const updatedScenes = [...day.scenes]
          const [movedItem] = updatedScenes.splice(oldIndex, 1)
          updatedScenes.splice(newIndex, 0, movedItem)

          setScheduleData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              shootDays: prev.shootDays.map((d) => (d.id === sourceDayId ? { ...d, scenes: updatedScenes } : d)),
            }
          })

          const reorderedIds = updatedScenes.map((s) => s.scene.id)
          await reorderDayScenesAction(sourceDayId, reorderedIds)
          loadSchedule()
        }
      }
    }
  }

  // Filtered Unscheduled Pool
  // One forgiving search for both lists ("scene 8", "#8", "sc8", "kitchen night"…), ranked
  const placedScenes = useMemo<PlacedScene[]>(
    () => (scheduleData?.shootDays || []).flatMap((day) => day.scenes.map((s) => ({ scene: s.scene, day }))),
    [scheduleData]
  )
  const poolResults = useMemo(
    () =>
      searchScenesDetailed(
        scheduleData?.unscheduledScenes || [],
        poolSearch,
        (sc) => sc,
        (sc) => searchIndex.get(sc.id)
      ),
    [scheduleData, poolSearch, searchIndex]
  )
  const placedResults = useMemo(
    () =>
      searchScenesDetailed(
        placedScenes,
        poolSearch,
        (p) => p.scene,
        (p) => searchIndex.get(p.scene.id),
        (p) => daySearchText(p.day)
      ),
    [placedScenes, poolSearch, searchIndex]
  )
  const searchedPool = useMemo(() => poolResults.map((r) => r.item), [poolResults])
  const searchedPlaced = useMemo(() => placedResults.map((r) => r.item), [placedResults])
  const matchById = useMemo(() => {
    const m = new Map<string, SceneMatch>()
    for (const r of poolResults) m.set(r.item.id, r.match)
    for (const r of placedResults) m.set(r.item.scene.id, r.match)
    return m
  }, [poolResults, placedResults])

  const filteredUnscheduledPool = useMemo(
    () => searchedPool.filter((s) => matchesIntExt(s.int_ext, intExtFilter)),
    [searchedPool, intExtFilter]
  )
  const filteredScheduled = useMemo(
    () => searchedPlaced.filter((p) => matchesIntExt(p.scene.int_ext, intExtFilter)),
    [searchedPlaced, intExtFilter]
  )

  // Matches the INT/EXT filter is hiding for the current view, so the panel can say so
  const hiddenByFilterCount =
    intExtFilter === 'ALL'
      ? 0
      : (scope !== 'SCHEDULED' ? searchedPool.length - filteredUnscheduledPool.length : 0) +
        (scope !== 'UNSCHEDULED' ? searchedPlaced.length - filteredScheduled.length : 0)

  // Scroll the board to a scene's day and flash the strip
  const handleLocateScene = (sceneId: string, dayId: string) => {
    requestAnimationFrame(() => {
      document.getElementById(`shoot-day-${dayId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      const strip = document.querySelector<HTMLElement>(`[data-scene-strip="${sceneId}"]`)
      if (!strip) return
      strip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      strip.classList.add('ring-4', 'ring-amber-400', 'ring-offset-2', 'ring-offset-background')
      strip.focus({ preventScroll: true })
      setTimeout(() => strip.classList.remove('ring-4', 'ring-amber-400', 'ring-offset-2', 'ring-offset-background'), 2500)
    })
  }

  const visibleDays = (scheduleData?.shootDays || []).filter((d) => !hideEmptyDays || d.scenes.length > 0)
  const emptyDayCount = (scheduleData?.shootDays || []).filter((d) => d.scenes.length === 0).length

  // Total Scheduled Pages Calculation
  const totalScheduledPages = useMemo(() => {
    if (!scheduleData?.shootDays) return 0
    return scheduleData.shootDays.reduce((total, day) => {
      const dayPages = day.scenes.reduce((sum, item) => {
        const start = item.scene.page_start || 1
        const end = item.scene.page_end || start
        return sum + Math.max(0.1, end - start + 0.1)
      }, 0)
      return total + dayPages
    }, 0)
  }, [scheduleData])

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6 w-full">
        {/* TOP STRIPBOARD DASHBOARD STATS & RIBBON */}
        <div className="bg-background border border-border p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
          {/* Stats Overview */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3 text-amber-600 dark:text-amber-500" />
                Shoot Days
              </div>
              <div className="text-xl font-mono font-bold text-foreground">
                {scheduleData?.shootDays.length || 0} Days
              </div>
            </div>

            <div className="h-8 w-px bg-muted hidden sm:block" />

            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <FileText className="size-3 text-amber-700 dark:text-amber-400" />
                Scheduled Pages
              </div>
              <div className="text-xl font-mono font-bold text-amber-700 dark:text-amber-400">
                {totalScheduledPages.toFixed(1)} Pgs
              </div>
            </div>

            <div className="h-8 w-px bg-muted hidden sm:block" />

            <div className="space-y-0.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Layers className="size-3 text-muted-foreground" />
                Unscheduled Pool
              </div>
              <div className="text-xl font-mono font-bold text-subtle-foreground">
                {scheduleData?.unscheduledScenes.length || 0} Scenes
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <ScheduleVersionSwitcher
              projectId={projectId}
              onScheduleRestored={loadSchedule}
            />

            {/* Rules Engine Conflict Trigger */}
            <button
              type="button"
              onClick={() => setIsInspectorOpen(true)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                conflicts.length > 0
                  ? conflicts.some((c) => c.severity === 'CRITICAL')
                    ? 'bg-rose-500/10 border-rose-500/50 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 ring-1 ring-rose-500/30'
                    : 'bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
              }`}
              title="Click to view schedule rules & conflict analysis"
            >
              <ShieldCheck className="size-4" />
              <span>
                {conflicts.length === 0
                  ? 'Rules Engine Active'
                  : `${conflicts.length} Conflict Alert${conflicts.length > 1 ? 's' : ''}`}
              </span>
            </button>

            {/* AI Schedule Advisor Trigger */}
            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Click to view AI Schedule Health Advisor & Diagnostic Tips"
            >
              <Sparkles className="size-4 text-purple-700 dark:text-purple-400" />
              <span>AI Advisor</span>
            </button>

            {/* AI Scenarios & Proposals Trigger */}
            <button
              type="button"
              onClick={() => setIsProposalsModalOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Click to view AI Schedule Optimization Proposals & Cost Scenarios"
            >
              <Wand2 className="size-4 text-amber-700 dark:text-amber-400" />
              <span>AI Scenarios</span>
            </button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAutoScheduleOpen(true)}
              disabled={!scheduleData || (scheduleData.unscheduledScenes.length === 0 && emptyDayCount === 0 && !scheduleData.shootDays.some((d) => /^Auto-(grouped|scheduled)/.test(d.notes || '')))}
              className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-mono h-9 cursor-pointer"
              title="Plan unscheduled scenes into shoot days — preview before anything changes"
            >
              <Wand2 className="size-3.5 mr-1.5" />
              <span>Smart Auto-Schedule</span>
              {emptyDayCount > 0 && (
                <span className="ml-1.5 px-1.5 rounded bg-amber-500/15 text-[10px]" title={`${emptyDayCount} empty days`}>
                  {emptyDayCount} empty
                </span>
              )}
            </Button>

            <Button
              type="button"
              onClick={handleAddShootDay}
              disabled={isCreatingDay}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono h-9 cursor-pointer shadow-md"
            >
              <Plus className="size-4 mr-1" />
              <span>+ Add Shoot Day</span>
            </Button>

            <button
              type="button"
              onClick={loadSchedule}
              className="p-2 rounded-lg bg-card border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Refresh Schedule Board"
            >
              <RefreshCw className={`size-4 ${isLoading ? 'animate-spin text-amber-600 dark:text-amber-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* STRIPBOARD MAIN SPLIT (UNSCHEDULED POOL vs SHOOT DAYS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN: UNSCHEDULED SCENES POOL (Span 4) */}
          <UnscheduledPoolSection
            filteredUnscheduledPool={filteredUnscheduledPool}
            filteredScheduled={filteredScheduled}
            scope={scope}
            setScope={setScope}
            onLocateScene={handleLocateScene}
            hiddenByFilterCount={hiddenByFilterCount}
            matchById={matchById}
            totalUnscheduledCount={scheduleData?.unscheduledScenes.length || 0}
            poolSearch={poolSearch}
            setPoolSearch={setPoolSearch}
            intExtFilter={intExtFilter}
            setIntExtFilter={setIntExtFilter}
            shootDays={scheduleData?.shootDays || []}
            onAssignSceneToDay={handleAssignSceneToDay}
          />

          {/* RIGHT AREA: SHOOT DAYS COLUMNS (Span 8) */}
          <div className="lg:col-span-8">
            {isLoading && !scheduleData ? (
              <div className="p-16 text-center text-muted-foreground font-mono text-xs border border-border rounded-2xl bg-background space-y-3">
                <RefreshCw className="size-6 animate-spin text-amber-600 dark:text-amber-500 mx-auto" />
                <p>Loading Stripboard Schedule Board...</p>
              </div>
            ) : scheduleData?.shootDays.length === 0 ? (
              <div className="p-16 text-center text-faint font-mono text-xs border border-border rounded-2xl bg-background space-y-4">
                <Calendar className="size-10 mx-auto text-faint" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">No Shoot Days Created Yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Click <strong>&quot;+ Add Shoot Day&quot;</strong> to create Day 1 manually, or <strong>&quot;Smart Auto-Schedule&quot;</strong> to plan every scene into shoot days by location, pages and availability.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setIsAutoScheduleOpen(true)}
                    disabled={!scheduleData || scheduleData.unscheduledScenes.length === 0}
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono cursor-pointer"
                  >
                    <Wand2 className="size-3.5 mr-1.5" />
                    <span>Smart Auto-Schedule</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddShootDay}
                    className="border-border text-subtle-foreground hover:text-foreground text-xs font-mono cursor-pointer"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    <span>+ Add Day 1</span>
                  </Button>
                </div>
              </div>
            ) : (
              /* Horizontal / Grid Scrolling Shoot Days Columns */
              <div className="space-y-2">
              {emptyDayCount > 0 && (
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteEmptyDays}
                    disabled={isDeletingEmpty}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 text-xs text-red-700 dark:text-red-400 hover:bg-red-500/10 cursor-pointer disabled:cursor-wait disabled:opacity-60 transition-colors"
                  >
                    {isDeletingEmpty ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    Delete {emptyDayCount} empty days
                  </button>
                  <button
                    type="button"
                    onClick={() => setHideEmptyDays((v) => !v)}
                    aria-pressed={hideEmptyDays}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      hideEmptyDays
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <EyeOff className="size-3.5" />
                    {hideEmptyDays ? `Showing days with scenes (${emptyDayCount} empty hidden)` : `Hide ${emptyDayCount} empty days`}
                  </button>
                </div>
              )}
              {/* Framed strip: cards scroll inside rounded edges instead of being cut off square */}
              <div className="rounded-2xl border border-border bg-muted/30 shadow-sm overflow-hidden">
              <div className="flex gap-4 overflow-x-auto p-3 pb-4 custom-scrollbar min-h-[650px]">
                {visibleDays.map((day) => (
                  <div key={day.id} id={`shoot-day-${day.id}`} className="shrink-0 scroll-mx-4">
                  <ShootDayColumn
                    day={day}
                    conflicts={conflicts}
                    onRefresh={loadSchedule}
                    onOpenInspector={() => setIsInspectorOpen(true)}
                    onAssignScenePrompt={(dayId) => setPickerDayId(dayId)}
                    timeline={timelines.get(day.id)}
                    onFindFixes={(conflict) => setFixRequest({ kind: 'conflict', conflict })}
                    onFillTime={(dayId) => setFixRequest({ kind: 'fill', dayId })}
                  />
                  </div>
                ))}
              </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeScene ? (
          <StripboardStrip scene={activeScene} isOverlay />
        ) : null}
      </DragOverlay>

      <AssignScenePicker
        isOpen={pickerDayId !== null}
        onClose={() => setPickerDayId(null)}
        dayLabel={`Day ${scheduleData?.shootDays.find((d) => d.id === pickerDayId)?.day_number ?? ''}`}
        scenes={scheduleData?.unscheduledScenes || []}
        onPick={(sceneId) => {
          if (pickerDayId) handleAssignSceneToDay(sceneId, pickerDayId)
          setPickerDayId(null)
        }}
      />

      {/* Conflict Inspector Modal */}
      <ConflictInspectorModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        conflicts={conflicts}
        onApplyQuickFix={handleApplyQuickFix}
        onFindFixes={(conflict) => {
          setIsInspectorOpen(false)
          setFixRequest({ kind: 'conflict', conflict })
        }}
      />

      <ScheduleFixModal
        key={fixRequest ? (fixRequest.kind === 'conflict' ? fixRequest.conflict.id : `fill-${fixRequest.dayId}`) : 'closed'}
        request={fixRequest}
        onClose={() => setFixRequest(null)}
        projectId={projectId}
        schedule={scheduleData}
        constraints={constraints}
        currency={constraints.currency}
        onApplied={loadSchedule}
      />

      {/* Mounted only while open, so every opening starts from fresh options */}
      {isAutoScheduleOpen && (
        <AutoScheduleModal
          isOpen
          onClose={() => setIsAutoScheduleOpen(false)}
          projectId={projectId}
          schedule={scheduleData}
          constraints={constraints}
          onApplied={loadSchedule}
        />
      )}

      {/* AI Schedule Advisor Modal */}
      <AiAnalysisModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        projectId={projectId}
      />

      {/* AI Proposals & Scenarios Modal */}
      <AiProposalsModal
        isOpen={isProposalsModalOpen}
        onClose={() => setIsProposalsModalOpen(false)}
        projectId={projectId}
        onProposalApplied={loadSchedule}
      />
    </DndContext>
  )
}

