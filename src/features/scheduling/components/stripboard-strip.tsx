'use client'

import React, { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Database } from '@/types/database'
import type { ScheduleConflict } from '../lib/conflict-detector'
import { getStripColorClasses } from '../lib/strip-colors'
import { SceneDetailModal } from '@/features/scenes/components/scene-detail-modal'
import {
  GripVertical,
  Clock,
  FileText,
  MapPin,
  X,
  ChevronUp,
  ChevronDown,
  CalendarPlus,
  AlertTriangle,
  Pin,
} from 'lucide-react'

type SceneRow = Database['public']['Tables']['scenes']['Row']

interface StripboardStripProps {
  scene: SceneRow
  estimatedMinutes?: number | null
  onRemove?: () => void
  /** Unscheduled pool: days offered in the strip's own "Assign to day" menu */
  assignOptions?: Array<{ id: string; label: string }>
  onAssign?: (dayId: string) => void
  /** Label for the assign menu (e.g. "Move" for scheduled search results) */
  assignLabel?: string
  /** Extra line inside the strip (e.g. why it matched a search) */
  note?: React.ReactNode
  /** A copy shown in search results: not draggable and not a jump target */
  isSearchResult?: boolean
  /** Planned time slot from the day's running order, e.g. "1:30 PM–3:00 PM" */
  slotLabel?: string
  /** Conflicts affecting this scene (shown as a warning marker) */
  sceneConflicts?: ScheduleConflict[]
  /** Makes the minutes editable */
  onChangeMinutes?: (minutes: number) => void
  /** AD-pinned start ("18:10") and a setter (null unpins) */
  fixedStartTime?: string | null
  onSetFixedStart?: (time: string | null) => void
  /** Opens fix suggestions for one of this scene's conflicts */
  onFindFixes?: (conflict: ScheduleConflict) => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  isUnscheduledPool?: boolean
  sourceDayId?: string // 'unscheduled' or shoot_day_id
  isOverlay?: boolean
}

export { getStripColorClasses } from '../lib/strip-colors'

export function StripboardStrip({
  scene,
  estimatedMinutes = 30,
  onRemove,
  assignOptions,
  onAssign,
  note,
  assignLabel = 'Assign',
  isSearchResult = false,
  slotLabel,
  sceneConflicts = [],
  onChangeMinutes,
  fixedStartTime = null,
  onSetFixedStart,
  onFindFixes,
  onMoveUp,
  onMoveDown,
  isUnscheduledPool = false,
  sourceDayId,
  isOverlay = false,
}: StripboardStripProps) {
  const colors = getStripColorClasses(scene.int_ext, scene.time_of_day)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditingMinutes, setIsEditingMinutes] = useState(false)
  const [isPinning, setIsPinning] = useState(false)
  const hasCritical = sceneConflicts.some((c) => c.severity === 'CRITICAL')

  // Double-click (or Enter when focused) opens the scene details; clicks on the strip's own buttons don't
  const openDetail = (e: React.SyntheticEvent) => {
    if (isOverlay || (e.target as HTMLElement).closest('button, select, a')) return
    setIsDetailOpen(true)
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: isSearchResult ? `search-${scene.id}` : scene.id,
    disabled: !sourceDayId || isOverlay || isSearchResult,
    data: {
      scene,
      sourceDayId: sourceDayId || 'unscheduled',
    },
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <>
    <div
      ref={setNodeRef}
      style={style}
      data-scene-strip={isSearchResult ? undefined : scene.id}
      onDoubleClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) openDetail(e)
      }}
      tabIndex={isOverlay ? undefined : 0}
      title={isOverlay ? undefined : 'Double-click for scene details'}
      className={`p-2.5 rounded-xl border transition-all select-none shadow-sm flex items-center justify-between gap-2 ${colors.container} ${
        hasCritical ? 'ring-2 ring-red-600 ring-offset-1 ring-offset-background' : ''
      } ${
        isOverlay ? 'shadow-2xl scale-[1.02] border-amber-400 ring-2 ring-amber-500/50 cursor-grabbing' : ''
      }`}
    >
      {/* Left: Drag / Order Controls + Scene Number */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          {...(sourceDayId && !isOverlay ? { ...attributes, ...listeners } : {})}
          className="opacity-70 hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5"
          title="Drag scene to reschedule"
        >
          <GripVertical className="size-3.5" />
        </span>

        {/* Scene # Pill */}
        <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-black/20 border border-black/10 shrink-0">
          #{scene.scene_number}
        </span>

        {/* Heading & Details */}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-bold uppercase tracking-wide truncate">
            {scene.heading || 'UNTITLED SCENE'}
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono opacity-80 truncate">
            {scene.location_name && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin className="size-3" />
                {scene.location_name}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <FileText className="size-3" />
              Pg {scene.page_start || 1}
            </span>
            {isEditingMinutes && onChangeMinutes ? (
              <input
                type="number"
                min={1}
                max={1440}
                autoFocus
                defaultValue={estimatedMinutes ?? 30}
                aria-label={`Estimated minutes for scene ${scene.scene_number}`}
                onBlur={(e) => {
                  setIsEditingMinutes(false)
                  const m = Number(e.target.value)
                  if (m && m !== estimatedMinutes) onChangeMinutes(m)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setIsEditingMinutes(false)
                }}
                className="w-14 h-5 px-1 rounded bg-black/20 border border-black/20 text-inherit font-mono text-[10px] outline-none"
              />
            ) : onChangeMinutes ? (
              <button
                type="button"
                onClick={() => setIsEditingMinutes(true)}
                className="flex items-center gap-0.5 rounded px-0.5 hover:bg-black/15 cursor-pointer"
                title="Estimated shooting time — click to change"
              >
                <Clock className="size-3" />
                {estimatedMinutes}m
              </button>
            ) : (
              <span className="flex items-center gap-0.5">
                <Clock className="size-3" />
                {estimatedMinutes}m
              </span>
            )}
          </div>
          {slotLabel && (
            <div className="flex items-center gap-1 text-[10px] font-mono font-bold opacity-90">
              <span title="Planned time from the day's running order">{slotLabel}</span>
              {isPinning && onSetFixedStart ? (
                <input
                  type="time"
                  autoFocus
                  defaultValue={fixedStartTime?.slice(0, 5) || ''}
                  aria-label={`Fixed start time for scene ${scene.scene_number}`}
                  onBlur={(e) => {
                    setIsPinning(false)
                    const v = e.target.value
                    if (v !== (fixedStartTime?.slice(0, 5) || '')) onSetFixedStart(v || null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setIsPinning(false)
                  }}
                  className="h-5 px-1 rounded bg-black/20 border border-black/20 text-inherit text-[10px] outline-none"
                />
              ) : onSetFixedStart ? (
                <button
                  type="button"
                  onClick={() => setIsPinning(true)}
                  className={`inline-flex items-center gap-0.5 rounded px-1 cursor-pointer ${
                    fixedStartTime ? 'bg-black/25' : 'opacity-60 hover:opacity-100 hover:bg-black/15'
                  }`}
                  title={fixedStartTime ? 'Fixed start — click to change or clear' : 'Fix this scene to an exact start time'}
                >
                  <Pin className="size-3" />
                  {fixedStartTime ? `fixed ${fixedStartTime.slice(0, 5)}` : null}
                </button>
              ) : null}
              {fixedStartTime && onSetFixedStart && !isPinning && (
                <button
                  type="button"
                  onClick={() => onSetFixedStart(null)}
                  className="opacity-60 hover:opacity-100 cursor-pointer"
                  aria-label="Clear fixed start time"
                  title="Clear fixed start time"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}
          {sceneConflicts.length > 0 && (
            <button
              type="button"
              onClick={() => onFindFixes?.(sceneConflicts.find((c) => c.severity === 'CRITICAL') || sceneConflicts[0])}
              disabled={!onFindFixes}
              className={`mt-0.5 inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-sans font-semibold normal-case text-left ${
                hasCritical ? 'bg-red-700 text-white' : 'bg-black/25'
              } ${onFindFixes ? 'cursor-pointer hover:brightness-110' : ''}`}
              title={`${sceneConflicts.map((c) => `${c.title}\n${c.description}`).join('\n\n')}${onFindFixes ? '\n\nClick to see fixes' : ''}`}
            >
              <AlertTriangle className="size-3 shrink-0" />
              <span className="truncate">
                {sceneConflicts[0].title}
                {sceneConflicts.length > 1 ? ` +${sceneConflicts.length - 1}` : ''}
              </span>
              {onFindFixes && <span className="shrink-0 underline underline-offset-2">Fix</span>}
            </button>
          )}
          {note && <div className="text-[10px] font-sans normal-case opacity-90 truncate mt-0.5">{note}</div>}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Int/Ext + Time Pill */}
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${colors.badge}`}>
          {(scene.int_ext || 'INT').replace('_', '/')} · {scene.time_of_day || 'DAY'}
        </span>

        {isUnscheduledPool ? (
          onAssign &&
          assignOptions &&
          assignOptions.length > 0 && (
            <label className="relative inline-flex items-center" title="Assign this scene to a shoot day">
              <span className="sr-only">Assign scene {scene.scene_number} to a shoot day</span>
              <CalendarPlus className="size-3 absolute left-1.5 pointer-events-none" />
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) onAssign(e.target.value)
                }}
                className="appearance-none h-6 pl-5 pr-5 rounded text-[10px] font-mono font-bold bg-black/15 hover:bg-black/25 border border-black/15 text-inherit cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-black/40"
              >
                <option value="" className="bg-background text-foreground">
                  {assignLabel}
                </option>
                {assignOptions.map((d) => (
                  <option key={d.id} value={d.id} className="bg-background text-foreground">
                    {d.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="size-3 absolute right-1 pointer-events-none" />
            </label>
          )
        ) : (
          <div className="flex items-center gap-0.5">
            {onMoveUp && (
              <button
                type="button"
                onClick={onMoveUp}
                className="p-1 hover:bg-black/20 rounded transition-colors"
                title="Move Up"
              >
                <ChevronUp className="size-3" />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={onMoveDown}
                className="p-1 hover:bg-black/20 rounded transition-colors"
                title="Move Down"
              >
                <ChevronDown className="size-3" />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1 hover:bg-black/30 rounded text-rose-300 transition-colors cursor-pointer"
                title="Remove scene from shoot day"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    {!isOverlay && (
      <SceneDetailModal sceneId={isDetailOpen ? scene.id : null} onClose={() => setIsDetailOpen(false)} />
    )}
    </>
  )
}

