'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useFeedback } from '@/components/ui/feedback-provider'
import type {
  SceneBreakdownData,
  LinkedResource,
} from '../actions'
import {
  addSceneElementAction,
  updateSceneElementAction,
  deleteSceneElementAction,
  autoExtractSceneElementsAction,
  confirmAllSceneElementsAction,
  addSceneTagAction,
  deleteSceneTagAction,
  getLinkableResourcesAction,
  getCharactersAction,
  isLinkableElementType,
} from '../actions'
import { breakdownLabel, UNCAST_ACTOR_NAME } from '../lib/resource-links'
import { OneLinerEditor } from './one-liner-editor'
import { cleanSceneHeading, formatEighths, sceneEighths, sceneTimeLabel } from '../lib/one-liners'
import type { Database } from '@/types/database'
import type { SceneElementType, ElementConfirmStatus, SceneTagType } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Wand2,
  CheckCircle2,
  Plus,
  Trash2,
  Tag,
  Users,
  Box,
  Car,
  Flame,
  Sparkles,
  Shirt,
  Scissors,
  Check,
  X,
  AlertCircle,
  FileText,
  Clock,
  Layers,
  Edit2,
  Link2,
  Sofa,
  Leaf,
  Camera,
  Lightbulb,
  Shield,
  HardHat,
} from 'lucide-react'

type ResourceRow = Database['public']['Tables']['resources']['Row']

interface SceneBreakdownCardProps {
  data: SceneBreakdownData
  projectId: string
  onRefresh: () => void
  /** A one-liner was saved or drafted (keeps the scene list in step without a reload) */
  onSynopsisChange?: (sceneId: string, synopsis: string | null, source: 'AI' | 'USER' | null) => void
}

const ELEMENT_TYPE_CONFIG: Record<
  SceneElementType,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  CAST: { label: 'Cast Members', icon: Users, colorClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  EXTRA: { label: 'Background / Extras', icon: Users, colorClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30' },
  PROP: { label: 'Props', icon: Box, colorClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30' },
  WARDROBE: { label: 'Wardrobe / Costumes', icon: Shirt, colorClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  MAKEUP: { label: 'Makeup & Hair', icon: Scissors, colorClass: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30' },
  VEHICLE: { label: 'Picture Vehicles', icon: Car, colorClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30' },
  STUNT: { label: 'Stunts & Action', icon: Flame, colorClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30' },
  VFX: { label: 'Visual Effects (VFX)', icon: Sparkles, colorClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30' },
  SFX: { label: 'Special Effects (SFX)', icon: Flame, colorClass: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' },
  LOCATION: { label: 'Location Specs', icon: Layers, colorClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  ANIMAL: { label: 'Animals / Wranglers', icon: Box, colorClass: 'bg-amber-600/10 text-amber-600 dark:text-amber-500 border-amber-600/30' },
  SOUND: { label: 'Sound / Music Cues', icon: FileText, colorClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30' },
  EQUIPMENT: { label: 'Special Equipment', icon: Box, colorClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30' },
  MUSIC: { label: 'Music', icon: FileText, colorClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30' },
  SET_DRESSING: { label: 'Set Dressing', icon: Sofa, colorClass: 'bg-lime-500/10 text-lime-700 dark:text-lime-400 border-lime-500/30' },
  GREENERY: { label: 'Greenery', icon: Leaf, colorClass: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30' },
  CAMERA: { label: 'Camera Equipment', icon: Camera, colorClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30' },
  LIGHTING_GRIP: { label: 'Lighting & Grip', icon: Lightbulb, colorClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
  SECURITY: { label: 'Security', icon: Shield, colorClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  ADDITIONAL_LABOR: { label: 'Additional Labor', icon: HardHat, colorClass: 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/30' },
  OTHER: { label: 'Other Elements', icon: Box, colorClass: 'bg-muted text-subtle-foreground border-border-strong' },
}

/** Dropdown and section order, grouped by department */
const CATEGORY_KEYS: SceneElementType[] = [
  'CAST',
  'EXTRA',
  'STUNT',
  'LOCATION',
  'SET_DRESSING',
  'GREENERY',
  'PROP',
  'WARDROBE',
  'MAKEUP',
  'VEHICLE',
  'ANIMAL',
  'VFX',
  'SFX',
  'CAMERA',
  'LIGHTING_GRIP',
  'EQUIPMENT',
  'SOUND',
  'MUSIC',
  'SECURITY',
  'ADDITIONAL_LABOR',
  'OTHER',
]

export function SceneBreakdownCard({ data, projectId, onRefresh, onSynopsisChange }: SceneBreakdownCardProps) {
  const { scene, elements, tags, links } = data
  const { notify } = useFeedback()

  const { eighths, estimated: eighthsEstimated } = sceneEighths(scene)

  const [isExtracting, setIsExtracting] = useState(false)
  const [isConfirmingAll, setIsConfirmingAll] = useState(false)
  const [newElementName, setNewElementName] = useState('')
  const [newElementType, setNewElementType] = useState<SceneElementType>('CAST')
  const [newTagLabel, setNewTagLabel] = useState('')
  const [isAddingElement, setIsAddingElement] = useState(false)
  // Existing characters (for CAST) or Cast & Crew entries (everything else), offered while typing
  type LinkOption = { id: string; label: string; hint: string; isPerson: boolean }
  const [optionsByType, setOptionsByType] = useState<Partial<Record<SceneElementType, LinkOption[]>>>({})
  const linkOptions = optionsByType[newElementType] || []

  useEffect(() => {
    if (!isLinkableElementType(newElementType)) return
    let cancelled = false
    const load: Promise<LinkOption[]> =
      newElementType === 'CAST'
        ? getCharactersAction(projectId).then((rows) =>
            rows.map((c) => ({
              id: c.id,
              label: c.name,
              hint: c.actorName ? `#${c.castNumber ?? '?'} · played by ${c.actorName}` : 'not cast yet',
              isPerson: false,
            }))
          )
        : getLinkableResourcesAction(projectId, newElementType).then((rows: ResourceRow[]) =>
            rows.map((r) => ({
              id: r.id,
              label: breakdownLabel(r),
              hint: r.resource_type === 'PERSON' && r.name !== UNCAST_ACTOR_NAME ? r.name : '',
              isPerson: r.resource_type === 'PERSON',
            }))
          )
    load.then((opts) => {
      if (!cancelled) setOptionsByType((prev) => ({ ...prev, [newElementType]: opts }))
    })
    return () => {
      cancelled = true
    }
  }, [projectId, newElementType])

  const typedLabel = newElementName.trim().toUpperCase()
  const matchedOption = typedLabel ? linkOptions.find((o) => o.label.toUpperCase() === typedLabel) : undefined

  // Inline element editing state
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<SceneElementType>('CAST')
  const [editDesc, setEditDesc] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const handleStartEdit = (item: typeof elements[0]) => {
    setEditingElementId(item.id)
    setEditName(item.name)
    setEditType(item.element_type)
    setEditDesc(item.description || '')
  }

  const handleSaveEdit = async (elementId: string) => {
    if (!editName.trim()) return
    setIsSavingEdit(true)
    const res = await updateSceneElementAction(elementId, {
      name: editName,
      elementType: editType,
      description: editDesc,
      confirmStatus: 'EDITED',
    })
    if (!res.success) notify(res.error || 'Could not save the change', 'error')
    setIsSavingEdit(false)
    setEditingElementId(null)
    onRefresh()
  }

  // Handle Auto Extraction
  const handleAutoExtract = async () => {
    setIsExtracting(true)
    const res = await autoExtractSceneElementsAction(scene.id)
    setIsExtracting(false)
    if (res.success) {
      onRefresh()
    }
  }

  // Handle Confirm All
  const handleConfirmAll = async () => {
    setIsConfirmingAll(true)
    await confirmAllSceneElementsAction(scene.id, projectId)
    setIsConfirmingAll(false)
    onRefresh()
  }

  // Handle Add Element
  const handleAddElement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newElementName.trim()) return
    setIsAddingElement(true)
    const res = await addSceneElementAction(
      scene.id,
      newElementType,
      matchedOption ? matchedOption.label : newElementName,
      undefined,
      undefined,
      matchedOption?.id
    )
    setIsAddingElement(false)
    if (res.success) {
      setNewElementName('')
      onRefresh()
    } else {
      notify(res.error || 'Could not add the element', 'error')
    }
  }

  // Toggle Confirm Status
  const handleToggleConfirmStatus = async (elementId: string, currentStatus: ElementConfirmStatus) => {
    const nextStatus: ElementConfirmStatus = currentStatus === 'CONFIRMED' ? 'AI_DETECTED' : 'CONFIRMED'
    await updateSceneElementAction(elementId, { confirmStatus: nextStatus })
    onRefresh()
  }

  // Delete Element
  const handleDeleteElement = async (elementId: string) => {
    const res = await deleteSceneElementAction(elementId)
    if (!res.success) notify(res.error || 'Could not delete the element', 'error')
    onRefresh()
  }

  // Add Tag
  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagLabel.trim()) return
    await addSceneTagAction(projectId, scene.id, 'CUSTOM', newTagLabel)
    setNewTagLabel('')
    onRefresh()
  }

  // Delete Tag
  const handleDeleteTag = async (tagId: string) => {
    await deleteSceneTagAction(tagId)
    onRefresh()
  }

  // Group elements by category
  const elementsByType = elements.reduce((acc, elem) => {
    if (!acc[elem.element_type]) acc[elem.element_type] = []
    acc[elem.element_type].push(elem)
    return acc
  }, {} as Record<SceneElementType, typeof elements>)

  return (
    <div className="bg-background border border-border rounded-2xl p-5 shadow-2xl space-y-6">
      {/* SCENE HEADER SHEET */}
      <div className="bg-card/80 border border-border/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Scene Number & Heading */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-mono font-bold text-xs">
              SCENE {scene.scene_number}
            </span>
            {scene.int_ext && (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 font-mono text-[10px]">
                {scene.int_ext}
              </Badge>
            )}
            {sceneTimeLabel(scene) && (
              <Badge variant="outline" className="border-border-strong text-subtle-foreground font-mono text-[10px] uppercase">
                {sceneTimeLabel(scene)}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`font-mono text-[10px] ${
                scene.status === 'CONFIRMED' || scene.status === 'LOCKED'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {scene.status}
            </Badge>
          </div>

          <h2 className="text-base font-bold text-foreground font-mono uppercase tracking-wide">
            {cleanSceneHeading(scene.heading) || 'UNTITLED SCENE'}
          </h2>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-mono">
            <span>Location: <strong className="text-foreground">{scene.location_name || 'N/A'}</strong></span>
            <span>Page {scene.page_start || 1}</span>
            <span title={eighthsEstimated ? 'Estimated — re-upload the script to measure it exactly' : 'Scene length in eighths of a page'}>
              {formatEighths(eighths)} pgs{eighthsEstimated ? '*' : ''}
            </span>
            {scene.estimated_duration && (
              <span className="flex items-center gap-1">
                <Clock className="size-3 text-amber-600 dark:text-amber-500" />
                {scene.estimated_duration} mins
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions (Auto Extract & Confirm All) */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoExtract}
            disabled={isExtracting}
            className="border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-mono cursor-pointer"
          >
            <Wand2 className={`size-3.5 mr-1.5 ${isExtracting ? 'animate-spin' : ''}`} />
            <span>{isExtracting ? 'Extracting...' : 'Auto-Extract Elements'}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmAll}
            disabled={isConfirmingAll || elements.length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs font-mono cursor-pointer"
          >
            <CheckCircle2 className="size-3.5 mr-1.5" />
            <span>Confirm Breakdown</span>
          </Button>
        </div>
      </div>

      {/* ONE-LINER */}
      <OneLinerEditor
        sceneId={scene.id}
        projectId={projectId}
        synopsis={scene.synopsis}
        source={scene.synopsis_source}
        onChange={onSynopsisChange}
      />

      {/* SCENE TAGS BAR */}
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-border/80">
        <span className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Tag className="size-3 text-amber-600 dark:text-amber-500" />
          Scene Tags:
        </span>
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="px-2 py-0.5 rounded-full bg-card border border-border-strong text-amber-700 dark:text-amber-400 text-[11px] font-mono flex items-center gap-1.5"
          >
            <span>{tag.label}</span>
            <button
              type="button"
              onClick={() => handleDeleteTag(tag.id)}
              className="text-faint hover:text-rose-700 dark:hover:text-rose-400 transition-colors"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {/* Quick Tag Form */}
        <form onSubmit={handleAddTag} className="flex items-center gap-1">
          <input
            type="text"
            value={newTagLabel}
            onChange={(e) => setNewTagLabel(e.target.value)}
            placeholder="+ Tag (e.g. STUNT, WATER)"
            className="h-6 px-2 text-[11px] font-mono bg-card border border-border rounded text-foreground placeholder:text-faint focus:outline-none focus:border-amber-500"
          />
        </form>
      </div>

      {/* QUICK ADD ELEMENT FORM */}
      <form onSubmit={handleAddElement} className="bg-card/50 border border-border p-3 rounded-xl flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono font-bold text-subtle-foreground uppercase">
          + Add Element:
        </span>
        <select
          value={newElementType}
          onChange={(e) => setNewElementType(e.target.value as SceneElementType)}
          className="h-8 px-2 text-xs font-mono rounded bg-background border border-border text-amber-700 dark:text-amber-400 font-bold focus:outline-none"
        >
          {CATEGORY_KEYS.map((cat) => (
            <option key={cat} value={cat}>
              {ELEMENT_TYPE_CONFIG[cat]?.label || cat}
            </option>
          ))}
        </select>

        <div className="flex-1 min-w-[200px] space-y-1">
          <Input
            value={newElementName}
            onChange={(e) => setNewElementName(e.target.value)}
            list={`linkable-${scene.id}`}
            placeholder={
              newElementType === 'CAST'
                ? 'Character name, e.g. LAKHAN — pick one or type a new one'
                : 'Element name (e.g. 1988 Chevy Impala, Red brief case)'
            }
            className="h-8 text-xs font-mono bg-background border-border text-foreground w-full"
          />
          <datalist id={`linkable-${scene.id}`}>
            {linkOptions.map((o) => (
              <option key={o.id} value={o.label}>
                {o.hint}
              </option>
            ))}
          </datalist>
          {typedLabel && isLinkableElementType(newElementType) && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Link2 className="size-3" />
              {newElementType === 'CAST'
                ? matchedOption
                  ? `${matchedOption.label} — ${matchedOption.hint}`
                  : `New character ${typedLabel} — cast them in Cast & Crew → Characters`
                : matchedOption
                  ? `Links to existing Cast & Crew entry${matchedOption.hint ? ` (${matchedOption.hint})` : ''}`
                  : 'New entry will be added to Cast & Crew'}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={isAddingElement || !newElementName.trim()}
          className="h-8 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer"
        >
          <Plus className="size-3.5 mr-1" />
          <span>Add Element</span>
        </Button>
      </form>

      {/* BREAKDOWN ELEMENTS BY CATEGORY */}
      <div className="space-y-4">
        {elements.length === 0 ? (
          <div className="p-8 text-center text-faint font-mono text-xs border border-dashed border-border rounded-xl space-y-2">
            <Layers className="size-8 mx-auto text-faint" />
            <p>No breakdown elements tagged for Scene {scene.scene_number} yet.</p>
            <p className="text-[11px] text-faint">
              Click <strong>&quot;Auto-Extract Elements&quot;</strong> to parse screenplay characters & props, or use the form above to add elements manually.
            </p>
          </div>
        ) : (
          CATEGORY_KEYS.map((catKey) => {
            const catElements = elementsByType[catKey] || []
            if (catElements.length === 0) return null

            const cfg = ELEMENT_TYPE_CONFIG[catKey] || ELEMENT_TYPE_CONFIG.OTHER
            const Icon = cfg.icon

            return (
              <div key={catKey} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                  <div className={`p-1 rounded border ${cfg.colorClass}`}>
                    <Icon className="size-3.5" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                    {cfg.label} ({catElements.length})
                  </span>
                </div>

                {/* Elements List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  {catElements.map((item) => {
                    const isConfirmed = item.confirm_status === 'CONFIRMED' || item.confirm_status === 'EDITED'
                    const isEditingThis = editingElementId === item.id

                    if (isEditingThis) {
                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-xl border border-amber-500/50 bg-amber-500/10 space-y-2 col-span-1 sm:col-span-2 shadow-lg"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 uppercase">
                              Edit Element Details
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(item.id)}
                                disabled={isSavingEdit || !editName.trim()}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow"
                                title="Save changes"
                              >
                                <Check className="size-3.5 stroke-[3]" />
                                <span>Save</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingElementId(null)}
                                className="px-2 py-1 rounded bg-muted hover:bg-muted-strong text-subtle-foreground text-xs flex items-center gap-1 cursor-pointer"
                                title="Cancel editing"
                              >
                                <X className="size-3.5" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">
                                Element Name
                                {editType === 'CAST'
                                  ? ' · changes this scene only (rename a character in Cast & Crew → Characters)'
                                  : links[item.id]
                                    ? ' · renames it in Cast & Crew too'
                                    : ''}
                              </label>
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 text-xs font-mono bg-background border-border-strong text-foreground font-bold"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">
                                Category
                              </label>
                              <select
                                value={editType}
                                onChange={(e) => setEditType(e.target.value as SceneElementType)}
                                className="w-full h-8 px-2 text-xs font-mono rounded bg-background border border-border-strong text-amber-700 dark:text-amber-400 font-bold focus:outline-none"
                              >
                                {CATEGORY_KEYS.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {ELEMENT_TYPE_CONFIG[cat]?.label || cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">
                              Notes / Role Details (Optional)
                            </label>
                            <Input
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="e.g. Speaking character, stunt double, prop color..."
                              className="h-8 text-xs font-mono bg-background border-border-strong text-foreground"
                            />
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={item.id}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 group/card ${
                          isConfirmed
                            ? 'bg-card/60 border-border'
                            : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleConfirmStatus(item.id, item.confirm_status)}
                            className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                              isConfirmed
                                ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                                : 'text-amber-600 dark:text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                            }`}
                            title={isConfirmed ? 'Confirmed (Click to unconfirm)' : 'AI Detected (Click to confirm)'}
                          >
                            <Check className="size-3.5 stroke-[3]" />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-xs font-bold text-foreground truncate flex items-center gap-1">
                              <span>{item.name}</span>
                            </div>
                            {item.description && (
                              <div className="text-[10px] font-mono text-muted-foreground truncate">
                                {item.description}
                              </div>
                            )}
                            {item.element_type === 'CAST' && isConfirmed ? (
                              <Link
                                href={`/projects/${projectId}/resources?view=characters`}
                                className={`text-[11px] flex items-center gap-1 truncate hover:underline ${
                                  data.characters[item.id]?.actor
                                    ? 'text-muted-foreground'
                                    : 'text-amber-700 dark:text-amber-400'
                                }`}
                                title="Open the cast list"
                              >
                                <Link2 className="size-3 shrink-0" />
                                {data.characters[item.id]?.actor
                                  ? `#${data.characters[item.id].castNumber ?? '?'} · played by ${data.characters[item.id].actor!.name}`
                                  : 'Not cast yet — cast now'}
                              </Link>
                            ) : links[item.id] ? (
                              <Link
                                href={`/projects/${projectId}/resources/${links[item.id].id}`}
                                className="text-[11px] text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-1 truncate"
                                title={`Open ${links[item.id].name} in Cast & Crew`}
                              >
                                <Link2 className="size-3 shrink-0" />
                                {links[item.id].resource_type === 'PERSON'
                                  ? links[item.id].name === UNCAST_ACTOR_NAME
                                    ? 'Cast & Crew · actor not cast yet'
                                    : `Cast & Crew · ${links[item.id].name}`
                                  : linkedResourceSummary(links[item.id])}
                              </Link>
                            ) : (
                              isLinkableElementType(item.element_type) &&
                              !isConfirmed && (
                                <div className="text-[11px] text-faint">Confirm to add to Cast & Crew</div>
                              )
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                              isConfirmed
                                ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5'
                                : 'border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5'
                            }`}
                          >
                            {item.confirm_status}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="p-1 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 transition-colors cursor-pointer"
                            title="Edit element details & category"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteElement(item.id)}
                            className="p-1 text-faint hover:text-rose-700 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete element"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const RESOURCE_KIND: Record<string, string> = {
  LOCATION: 'Location',
  PROP: 'Prop',
  VEHICLE: 'Vehicle',
  ANIMAL: 'Animal',
  EQUIPMENT: 'Equipment',
  OTHER: 'Item',
}

/** "Prop · in 4 scenes" / "Location · only this scene" */
function linkedResourceSummary(link: LinkedResource) {
  const kind = RESOURCE_KIND[link.resource_type] ?? 'Item'
  if (!link.sceneCount) return kind
  return `${kind} · ${link.sceneCount === 1 ? 'only this scene' : `in ${link.sceneCount} scenes`}`
}
