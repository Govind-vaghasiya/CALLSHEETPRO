'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import type {
  ScriptDocumentWithStats,
  ScriptSceneItem,
  ScriptPageItem,
} from '@/features/scripts/actions'
import {
  updateSceneNumberAction,
  addSubSceneAction,
  reorderSceneAction,
  updateScenesOrderBatchAction,
  updateSceneContentAction,
  renumberAllScenesAction,
  updateScriptMetadataAction,
} from '@/features/scripts/actions'
import {
  getRevisionColorMeta,
  REVISION_COLORS_ORDERED,
} from '@/features/scripts/lib/revision-colors'
import {
  classifyScreenplayLines,
  type FormattedScreenplayLine,
} from '@/features/scripts/lib/screenplay-format'
import { parseSlugline } from '@/features/scripts/lib/slugline'
import { ScreenplayEditor } from './screenplay-editor'
import { ShortcutsModal } from './shortcuts-modal'
import { ScriptMetadataModal } from './script-metadata-modal'
import { exportToFountain, exportToFDX } from '../lib/screenplay-export-utils'
import { printFullScript, printScenes } from '../lib/screenplay-print'
import { useDismiss } from '@/components/ui/use-dismiss'
import type { RevisionColor } from '@/types/database'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Search,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  X,
  Plus,
  Moon,
  Sun,
  Printer,
  FileText,
  Layers,
  Sparkles,
  BookOpen,
  Eye,
  RefreshCw,
  GripVertical,
  Save,
  ArrowUpDown,
  MoveVertical,
  CheckCircle2,
  Lock,
  Unlock,
  Download,
  HelpCircle,
  FileDown,
} from 'lucide-react'
import { AddSceneModal } from './add-scene-modal'

interface ScreenplayReaderProps {
  script: ScriptDocumentWithStats
  scenes: ScriptSceneItem[]
  pages: ScriptPageItem[]
  initialSceneNumber?: string
  initialPageNumber?: number
}

export function ScreenplayReader({
  script,
  scenes: initialScenes,
  pages,
  initialSceneNumber,
  initialPageNumber = 1,
}: ScreenplayReaderProps) {
  // Local scenes state for immediate optimistic updates
  const [scenes, setScenes] = useState<ScriptSceneItem[]>(initialScenes)
  useEffect(() => {
    setScenes(initialScenes)
  }, [initialScenes])

  // Active scene selection by stable ID (prevents losing selected scene on renumber or reorder)
  const [activeSceneId, setActiveSceneId] = useState<string>(() => {
    if (initialSceneNumber) {
      const found = initialScenes.find((s) => s.scene_number === initialSceneNumber)
      if (found) return found.id
    }
    return initialScenes[0]?.id || ''
  })

  // View Mode: SINGLE_SCENE (Default) vs FULL_PAGE
  const [viewMode, setViewMode] = useState<'SINGLE_SCENE' | 'FULL_PAGE'>('SINGLE_SCENE')
  const [searchQuery, setSearchQuery] = useState('')
  const [activePageNum, setActivePageNum] = useState<number>(initialPageNumber || 1)

  // Appearance
  const [readerTheme, setReaderTheme] = useState<'WHITE' | 'DARK'>('WHITE')
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base')

  // Inline editing state for scene number
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Drag and drop state & auto-scroll container ref
  const scenesListRef = useRef<HTMLDivElement>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Edit scene script text mode
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [isSavingContent, setIsSavingContent] = useState(false)
  const [isAddSceneOpen, setIsAddSceneOpen] = useState(false)

  // Renumber Modal & Notification state
  const [isRenumberModalOpen, setIsRenumberModalOpen] = useState(false)
  const [renumberSuccessMsg, setRenumberSuccessMsg] = useState<string | null>(null)

  // Script Document & Revision Metadata State
  const [currentScriptDoc, setCurrentScriptDoc] = useState(script)
  const [isLocked, setIsLocked] = useState(false)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [showMetadataModal, setShowMetadataModal] = useState(false)

  // Global keyboard listener for shortcuts (Cmd + / or Ctrl + /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setShowShortcutsModal((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const colorMeta = getRevisionColorMeta(currentScriptDoc.revision_color)

  const nextSuggestedNumber = useMemo(() => {
    const nums = scenes
      .map((s) => parseInt(s.scene_number.replace(/\D/g, '')))
      .filter((n) => !isNaN(n))
    const max = nums.length > 0 ? Math.max(...nums) : 0
    return String(max + 1)
  }, [scenes])

  const handleSceneCreated = (newScene: ScriptSceneItem) => {
    setScenes((prev) => [...prev, newScene])
    setActiveSceneId(newScene.id)
    setIsEditingContent(true) // Automatically open Screenplay Studio editor for new scenes
  }

  // Active Scene Object (derived from activeSceneId)
  const activeSceneObj = useMemo(() => {
    return scenes.find((s) => s.id === activeSceneId) || scenes[0] || null
  }, [scenes, activeSceneId])

  // Update Script Metadata handler
  const handleUpdateMetadata = async (updated: {
    fileName: string
    version: number
    revisionColor: RevisionColor
    revisionNotes?: string
  }) => {
    setCurrentScriptDoc((prev) => ({
      ...prev,
      file_name: updated.fileName,
      version: updated.version,
      revision_color: updated.revisionColor,
      revision_notes: updated.revisionNotes ?? prev.revision_notes,
    }))

    await updateScriptMetadataAction(currentScriptDoc.id, currentScriptDoc.project_id, {
      fileName: updated.fileName,
      version: updated.version,
      revisionColor: updated.revisionColor,
      revisionNotes: updated.revisionNotes,
    })
    setRenumberSuccessMsg(`Updated screenplay metadata for "${updated.fileName}"!`)
    setTimeout(() => setRenumberSuccessMsg(null), 4000)
  }

  const handleExportFountain = () => {
    exportToFountain(currentScriptDoc.file_name, scenes)
  }

  const handleExportFDX = () => {
    exportToFDX(currentScriptDoc.file_name, 'Screenwriter', scenes)
  }

  // Sync active page when active scene changes
  useEffect(() => {
    if (activeSceneObj?.page_start) {
      setActivePageNum(activeSceneObj.page_start)
    }
  }, [activeSceneObj])

  // Filtered Scenes for left panel
  const filteredScenes = useMemo(() => {
    if (!searchQuery.trim()) return scenes
    const q = searchQuery.toLowerCase()
    return scenes.filter((s) => {
      const numMatch = s.scene_number.toLowerCase().includes(q)
      const locMatch = s.location_name?.toLowerCase().includes(q)
      const headingMatch = s.heading?.toLowerCase().includes(q)
      const descMatch = s.description?.toLowerCase().includes(q)
      return numMatch || locMatch || headingMatch || descMatch
    })
  }, [scenes, searchQuery])

  // ---- PDF / print: a clean screenplay document, never the screen
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false)
  const printMenuRef = useDismiss(isPrintMenuOpen, () => setIsPrintMenuOpen(false))
  const printTitle = script.file_name.replace(/\.(pdf|fdx|fountain|txt)$/i, '')
  const draftLabel = `${getRevisionColorMeta(script.revision_color).label} Draft v${script.version}`
  const handlePrintScene = () => {
    setIsPrintMenuOpen(false)
    if (activeSceneObj) printScenes({ title: printTitle, draftLabel, scenes: [activeSceneObj] })
  }
  const handlePrintFiltered = () => {
    setIsPrintMenuOpen(false)
    printScenes({ title: printTitle, draftLabel, scenes: filteredScenes })
  }
  const handlePrintFull = () => {
    setIsPrintMenuOpen(false)
    printFullScript({ title: printTitle, draftLabel, date: script.revision_date, pages, scenes })
  }

  // Formatted Screenplay Lines for the SELECTED SCENE
  const selectedSceneLines = useMemo(() => {
    if (!activeSceneObj) return []
    const textToFormat =
      activeSceneObj.description && activeSceneObj.description.trim().length > 0
        ? activeSceneObj.description.startsWith(activeSceneObj.heading || '')
          ? activeSceneObj.description
          : `${activeSceneObj.heading}\n\n${activeSceneObj.description}`
        : activeSceneObj.heading || ''

    const mapped = [{ sceneNumber: activeSceneObj.scene_number, heading: activeSceneObj.heading || '' }]
    return classifyScreenplayLines(textToFormat, mapped)
  }, [activeSceneObj])

  // Current page text for FULL_PAGE mode
  const currentPage = useMemo(() => {
    return pages.find((p) => p.page_number === activePageNum) || pages[0]
  }, [pages, activePageNum])

  const fullPageLines = useMemo(() => {
    if (!currentPage?.raw_text) return []
    const mapped = scenes.map((s) => ({ sceneNumber: s.scene_number, heading: s.heading || '' }))
    return classifyScreenplayLines(currentPage.raw_text, mapped)
  }, [currentPage, scenes])

  // Save Scene Number Edit (e.g., 4 -> 4A, 10 -> 10A)
  const handleSaveSceneNumber = async (sceneId: string) => {
    const trimmed = editValue.trim().toUpperCase()
    if (!trimmed) {
      setEditingSceneId(null)
      return
    }

    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, scene_number: trimmed } : s))
    )
    setActiveSceneId(sceneId)
    setEditingSceneId(null)

    await updateSceneNumberAction(sceneId, trimmed, script.project_id, script.id)
  }

  // Save Scene Content (Text / Dialogue / Action edit from ScreenplayEditor)
  const handleSaveContent = async (newHeading: string, newDesc: string) => {
    if (!activeSceneObj) return
    setIsSavingContent(true)

    const cleanHeading = newHeading.trim().toUpperCase()
    const slug = parseSlugline(cleanHeading)

    // Immediate optimistic local update
    setScenes((prev) =>
      prev.map((s) =>
        s.id === activeSceneObj.id
          ? {
              ...s,
              heading: cleanHeading,
              description: newDesc,
              int_ext: slug?.intExt || s.int_ext,
              location_name: slug?.locationName || s.location_name,
              time_of_day: slug?.timeOfDay || s.time_of_day,
            }
          : s
      )
    )

    await updateSceneContentAction(
      activeSceneObj.id,
      cleanHeading,
      newDesc,
      script.id,
      script.project_id
    )

    setIsSavingContent(false)
    setIsEditingContent(false)
  }

  // Add Sub-Scene (e.g. 4 -> 4A, or 4A -> 4B)
  const handleAddSubScene = async (parentScene: ScriptSceneItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setIsProcessing(true)

    const parentNum = parentScene.scene_number.replace(/[A-Z]+$/i, '')
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const siblings = scenes.filter((s) => s.scene_number.startsWith(parentNum))
    let nextLetter = 'A'
    for (const char of letters) {
      if (!siblings.some((s) => s.scene_number === `${parentNum}${char}`)) {
        nextLetter = char
        break
      }
    }
    const newSceneNumber = `${parentNum}${nextLetter}`

    const newSceneItem: ScriptSceneItem = {
      id: crypto.randomUUID(),
      project_id: script.project_id,
      script_document_id: script.id,
      scene_number: newSceneNumber,
      scene_order: (parentScene.scene_order || 0) + 1,
      heading: `${parentScene.heading || 'SCENE'} (PART ${nextLetter})`,
      int_ext: parentScene.int_ext || 'INT',
      location_name: parentScene.location_name || 'UNSPECIFIED LOCATION',
      time_of_day: parentScene.time_of_day || 'DAY',
      page_start: parentScene.page_start || 1,
      page_end: parentScene.page_end || 1,
      description: `${parentScene.heading || 'SCENE'} (PART ${nextLetter})\n\nSub-scene action details...`,
      estimated_duration: 30,
      episode_number: null,
      status: 'DETECTED',
      ai_confidence: null,
      revision_color: parentScene.revision_color || 'WHITE',
      is_changed: false,
      created_at: new Date().toISOString(),
    }

    setScenes((prev) => {
      const idx = prev.findIndex((s) => s.id === parentScene.id)
      if (idx === -1) return [...prev, newSceneItem]
      const copy = [...prev]
      copy.splice(idx + 1, 0, newSceneItem)
      return copy
    })
    setActiveSceneId(newSceneItem.id)
    setIsEditingContent(true)

    await addSubSceneAction(parentScene.id, script.project_id, script.id)
    setIsProcessing(false)
  }

  // Reorder Scene Up / Down (Click buttons)
  const handleReorder = async (
    scene: ScriptSceneItem,
    direction: 'UP' | 'DOWN',
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    const idx = scenes.findIndex((s) => s.id === scene.id)
    if (idx === -1) return
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= scenes.length) return

    const copy = [...scenes]
    const temp = copy[idx]
    copy[idx] = copy[targetIdx]
    copy[targetIdx] = temp

    setScenes(copy)
    setActiveSceneId(scene.id)
    await reorderSceneAction(scene.id, direction, script.project_id, script.id)
  }

  // Move Scene to Specific Target Position (e.g. Move Scene 157 directly to Position 15)
  const handleMoveSceneToPosition = async (sourceIdx: number, targetPosition: number) => {
    if (isNaN(targetPosition) || targetPosition < 1 || targetPosition > scenes.length) return
    const targetIdx = targetPosition - 1
    if (sourceIdx === targetIdx) return

    setIsProcessing(true)
    const reordered = [...scenes]
    const [movedItem] = reordered.splice(sourceIdx, 1)
    reordered.splice(targetIdx, 0, movedItem)

    setScenes(reordered)
    setActiveSceneId(movedItem.id)

    await updateScenesOrderBatchAction(
      reordered.map((s) => s.id),
      script.id,
      script.project_id
    )
    setIsProcessing(false)
  }

  // Drag and Drop Handlers with Smooth Auto-Scroll
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  const handleDragOver = (e: React.DragEvent, index?: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (index !== undefined && dragOverIdx !== index) {
      setDragOverIdx(index)
    }

    // Auto-Scroll container while dragging near edges
    const container = scenesListRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const threshold = 80 // pixels from top or bottom
      const offsetY = e.clientY - rect.top
      const fromBottom = rect.bottom - e.clientY

      if (offsetY < threshold && offsetY >= 0) {
        // Near top: scroll upward
        const factor = (threshold - offsetY) / threshold
        container.scrollTop -= Math.max(8, Math.round(factor * 35))
      } else if (fromBottom < threshold && fromBottom >= 0) {
        // Near bottom: scroll downward
        const factor = (threshold - fromBottom) / threshold
        container.scrollTop += Math.max(8, Math.round(factor * 35))
      }
    }
  }

  const handleDragLeave = () => {
    setDragOverIdx(null)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === dropIndex) {
      setDraggedIdx(null)
      setDragOverIdx(null)
      return
    }

    const reordered = [...scenes]
    const [movedItem] = reordered.splice(draggedIdx, 1)
    reordered.splice(dropIndex, 0, movedItem)

    setScenes(reordered)
    setDraggedIdx(null)
    setDragOverIdx(null)
    setActiveSceneId(movedItem.id)

    // Save batch order in database
    await updateScenesOrderBatchAction(
      reordered.map((s) => s.id),
      script.id,
      script.project_id
    )
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  // Confirm and execute Renumber All Scenes sequentially (1, 2, 3...)
  const confirmRenumberAll = async () => {
    setIsProcessing(true)
    setIsRenumberModalOpen(false)

    // Immediate optimistic local update
    setScenes((prev) =>
      prev.map((s, i) => ({
        ...s,
        scene_number: String(i + 1),
        scene_order: i + 1,
      }))
    )

    const res = await renumberAllScenesAction(script.id, script.project_id)
    setIsProcessing(false)

    if (res?.success) {
      setRenumberSuccessMsg(
        `All ${scenes.length} scenes have been cleanly renumbered sequentially (1 to ${scenes.length})!`
      )
      setTimeout(() => setRenumberSuccessMsg(null), 5000)
    }
  }

  return (
    <div className="space-y-4 w-full">
      {/* Renumber Success Feedback Banner */}
      {renumberSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl text-xs font-mono flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{renumberSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setRenumberSuccessMsg(null)}
            className="text-emerald-700/60 dark:text-emerald-400/60 hover:text-emerald-700 dark:hover:text-emerald-400 p-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Top Utility Ribbon / Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-2.5 rounded-xl shadow-md">
        {/* Left: Script Title Pill, Draft Color, Lock Toggle & Active Scene */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Script Title & Version (Click to edit metadata) */}
          <button
            type="button"
            onClick={() => setShowMetadataModal(true)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-background border border-border hover:border-amber-500 transition-colors cursor-pointer text-left"
            title="Click to edit script title, version, and draft metadata"
          >
            <span className="font-bold text-xs text-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {currentScriptDoc.file_name.replace('.pdf', '').replace('.PDF', '')}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
              v{currentScriptDoc.version}
            </span>
            <Edit2 className="size-3 text-faint hover:text-amber-700 dark:hover:text-amber-400" />
          </button>

          {/* Revision Draft Color Dropdown */}
          <select
            value={currentScriptDoc.revision_color}
            onChange={async (e) => {
              const color = e.target.value as RevisionColor
              setCurrentScriptDoc((prev) => ({ ...prev, revision_color: color }))
              await updateScriptMetadataAction(currentScriptDoc.id, currentScriptDoc.project_id, {
                revisionColor: color,
              })
              setRenumberSuccessMsg(`Draft color changed to ${color} Draft!`)
              setTimeout(() => setRenumberSuccessMsg(null), 3000)
            }}
            className="h-7 px-2 text-xs font-mono font-bold rounded-lg border bg-background cursor-pointer outline-none transition-colors border-border-strong text-amber-700 dark:text-amber-400 hover:border-zinc-500"
            title="Change Script Draft Revision Color"
          >
            {REVISION_COLORS_ORDERED.map((col: RevisionColor) => {
              const meta = getRevisionColorMeta(col)
              return (
                <option key={col} value={col}>
                  {meta.label} Draft
                </option>
              )
            })}
          </select>

          {/* Production Script Lock Toggle */}
          <button
            type="button"
            onClick={() => {
              const next = !isLocked
              setIsLocked(next)
              setRenumberSuccessMsg(
                next
                  ? '🔒 Script Locked for Production! Scene numbers are frozen.'
                  : '🔓 Script Unlocked. Auto-renumbering active.'
              )
              setTimeout(() => setRenumberSuccessMsg(null), 4000)
            }}
            className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
              isLocked
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-400 font-bold shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-border-strong'
            }`}
            title={
              isLocked
                ? 'Script is Locked (Scene numbers frozen for production)'
                : 'Lock Script (Freeze scene numbers for production)'
            }
          >
            {isLocked ? (
              <>
                <Lock className="size-3 text-rose-700 dark:text-rose-400" />
                <span>Locked</span>
              </>
            ) : (
              <>
                <Unlock className="size-3 text-muted-foreground" />
                <span>Unlocked</span>
              </>
            )}
          </button>

          <div className="h-4 w-px bg-muted mx-1 hidden sm:block" />

          {/* Active Scene Indicator */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
            <span className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-bold">
              SCENE {activeSceneObj?.scene_number}
            </span>
            <span className="font-semibold text-subtle-foreground truncate max-w-[180px] sm:max-w-[280px]">
              {activeSceneObj?.heading || activeSceneObj?.location_name}
            </span>
          </div>
        </div>

        {/* Right: Controls & Multi-Format Exports */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Scene Text Toggle */}
          {viewMode === 'SINGLE_SCENE' && (
            <button
              type="button"
              onClick={() => setIsEditingContent(!isEditingContent)}
              disabled={isSavingContent}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                isEditingContent
                  ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400'
                  : 'bg-background border-border text-subtle-foreground hover:text-foreground hover:border-border-strong'
              }`}
            >
              {isEditingContent ? (
                <>
                  <BookOpen className="size-3" />
                  <span>Reader View</span>
                </>
              ) : (
                <>
                  <Edit2 className="size-3" />
                  <span>Edit Scene</span>
                </>
              )}
            </button>
          )}

          {/* Mode Switcher: Selected Scene vs Full Page */}
          <div className="flex items-center bg-background border border-border rounded-lg p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setViewMode('SINGLE_SCENE')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'SINGLE_SCENE'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="size-3" />
              <span>Selected Scene</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('FULL_PAGE')}
              className={`px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'FULL_PAGE'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="size-3" />
              <span>Full Script ({pages.length}p)</span>
            </button>
          </div>

          {/* Theme Switcher: White Paper vs Dark */}
          <div className="flex items-center bg-background border border-border rounded-lg p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setReaderTheme('WHITE')}
              className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                readerTheme === 'WHITE'
                  ? 'bg-white text-zinc-950 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="size-3" />
              <span>White Paper</span>
            </button>
            <button
              type="button"
              onClick={() => setReaderTheme('DARK')}
              className={`px-2 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                readerTheme === 'DARK'
                  ? 'bg-muted text-amber-700 dark:text-amber-400 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Moon className="size-3" />
              <span>Dark</span>
            </button>
          </div>

          {/* Multi-Format Export Suite */}
          <div className="flex items-center gap-1">
            <div className="relative" ref={printMenuRef}>
              <button
                type="button"
                onClick={() => setIsPrintMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={isPrintMenuOpen}
                className="px-2 py-1 text-xs font-mono rounded-lg border border-border bg-background text-subtle-foreground hover:text-foreground hover:border-border-strong transition-colors cursor-pointer flex items-center gap-1"
                title="Print or save as PDF"
              >
                <Printer className="size-3" />
                <span className="hidden md:inline">PDF</span>
                <ChevronDown className="size-3" />
              </button>
              {isPrintMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-50 mt-1 w-60 rounded-xl border border-border bg-popover p-1 shadow-xl text-sm"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handlePrintScene}
                    disabled={!activeSceneObj}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted cursor-pointer disabled:opacity-50"
                  >
                    This scene{activeSceneObj ? ` (Sc ${activeSceneObj.scene_number})` : ''}
                  </button>
                  {searchQuery.trim() && filteredScenes.length > 1 && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handlePrintFiltered}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      Filtered scenes ({filteredScenes.length})
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handlePrintFull}
                    disabled={pages.length === 0}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted cursor-pointer disabled:opacity-50"
                  >
                    Full script ({pages.length} pages)
                  </button>
                  <p className="px-3 pt-1 pb-2 text-[11px] text-muted-foreground">
                    Choose &ldquo;Save as PDF&rdquo; in the print dialog to get a file.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportFDX}
              className="px-2 py-1 text-xs font-mono rounded-lg border border-border bg-background text-subtle-foreground hover:text-foreground hover:border-border-strong transition-colors cursor-pointer flex items-center gap-1"
              title="Export Final Draft (.fdx) file"
            >
              <FileDown className="size-3 text-amber-600 dark:text-amber-500" />
              <span className="hidden md:inline">FDX</span>
            </button>

            <button
              type="button"
              onClick={handleExportFountain}
              className="px-2 py-1 text-xs font-mono rounded-lg border border-border bg-background text-subtle-foreground hover:text-foreground hover:border-border-strong transition-colors cursor-pointer flex items-center gap-1"
              title="Export universal .Fountain plaintext script"
            >
              <FileText className="size-3 text-blue-700 dark:text-blue-400" />
              <span className="hidden md:inline">.fountain</span>
            </button>
          </div>

          {/* Shortcuts Help Trigger */}
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="size-7 rounded-full bg-background border border-border text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 hover:border-amber-500 transition-all font-mono font-bold text-xs flex items-center justify-center cursor-pointer shadow-sm"
            title="Keyboard Shortcuts Reference (Cmd + /)"
          >
            ?
          </button>
        </div>
      </div>

      {/* Main Screenplay Split View (Edge-to-Edge Direct Layout - Matching User's Image) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: SCENES LIST */}
        <div className="lg:col-span-4 xl:col-span-3 bg-background border border-border rounded-xl p-3 shadow-lg space-y-3">
          {/* Header with Scene Count, Add Scene, and Renumber All */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/80">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-subtle-foreground">
              SCENES ({scenes.length})
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsAddSceneOpen(true)}
                className="text-[11px] font-mono px-2 py-1 rounded bg-amber-500 text-zinc-950 hover:bg-amber-400 font-bold transition-colors cursor-pointer flex items-center gap-1"
                title="Add new scene"
              >
                <Plus className="size-3" />
                <span>Add</span>
              </button>
              <button
                type="button"
                onClick={() => setIsRenumberModalOpen(true)}
                disabled={isProcessing}
                className="text-[11px] font-mono px-2.5 py-1 rounded bg-card border border-border-strong text-subtle-foreground hover:text-foreground hover:border-zinc-500 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                title="Renumber all scenes sequentially (1, 2, 3...)"
              >
                <RefreshCw className={`size-3 ${isProcessing ? 'animate-spin text-amber-600 dark:text-amber-500' : ''}`} />
                <span>Renumber</span>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-faint" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter scenes..."
              className="pl-8 bg-card/90 border-border text-xs h-8 text-foreground placeholder:text-faint"
            />
          </div>

          {/* Draggable Scene Cards (Drag and Drop sequence reordering with Auto-Scroll) */}
          <div
            ref={scenesListRef}
            onDragOver={(e) => handleDragOver(e)}
            className="max-h-[820px] overflow-y-auto space-y-2 pr-1 custom-scrollbar"
          >
            {filteredScenes.length === 0 ? (
              <div className="p-8 text-center text-faint text-xs font-mono">
                No scenes matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredScenes.map((s, idx) => {
                const isSelected = activeSceneObj?.id === s.id
                const isEditing = editingSceneId === s.id
                const isDragging = draggedIdx === idx
                const isOver = dragOverIdx === idx

                return (
                  <div
                    key={s.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      if (!isEditing) {
                        setActiveSceneId(s.id)
                      }
                    }}
                    className={`p-3 rounded-lg border transition-all cursor-pointer relative select-none ${
                      isDragging
                        ? 'opacity-40 border-dashed border-amber-500 bg-amber-500/5'
                        : isOver
                        ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400'
                        : isSelected
                        ? 'border-amber-500 bg-amber-500/10 shadow-md ring-1 ring-amber-500/30'
                        : 'border-border/80 bg-card/60 hover:bg-card hover:border-border-strong'
                    }`}
                  >
                    {/* Top Row: Drag Handle + Scene Number + Actions */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      {/* Left: Drag Handle & Scene Number */}
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-faint hover:text-subtle-foreground cursor-grab active:cursor-grabbing p-0.5"
                          title="Drag up or down (list auto-scrolls)"
                        >
                          <GripVertical className="size-3.5" />
                        </span>

                        {isEditing ? (
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSceneNumber(s.id)
                                if (e.key === 'Escape') setEditingSceneId(null)
                              }}
                              className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold bg-background border border-amber-500 rounded text-amber-700 dark:text-amber-400 focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSceneNumber(s.id)}
                              className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-muted rounded"
                            >
                              <Check className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSceneId(null)}
                              className="p-1 text-muted-foreground hover:bg-muted rounded"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-1 group/edit"
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              setEditingSceneId(s.id)
                              setEditValue(s.scene_number)
                            }}
                          >
                            <span
                              className={`font-mono font-bold text-xs ${
                                isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-amber-600 dark:text-amber-500'
                              }`}
                            >
                              SCENE {s.scene_number}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSceneId(s.id)
                                setEditValue(s.scene_number)
                              }}
                              className="opacity-0 group-hover/edit:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-0.5 cursor-pointer"
                              title="Rename Scene (e.g. 4A, 10B)"
                            >
                              <Edit2 className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right Controls: Move Up, Move Down, Jump to #, + Sub */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleReorder(s, 'UP', e)}
                          disabled={idx === 0}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Move Scene Up"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleReorder(s, 'DOWN', e)}
                          disabled={idx === scenes.length - 1}
                          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Move Scene Down"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                        {/* Quick Jump / Move to Position # */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            const target = prompt(
                              `Move Scene ${s.scene_number} directly to position (1-${scenes.length}):`,
                              String(idx + 1)
                            )
                            if (target && !isNaN(Number(target))) {
                              handleMoveSceneToPosition(idx, parseInt(target, 10))
                            }
                          }}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400 hover:bg-muted transition-colors cursor-pointer border border-border/80"
                          title={`Move Scene ${s.scene_number} to position #`}
                        >
                          #{idx + 1}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleAddSubScene(s, e)}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-muted hover:bg-muted-strong text-subtle-foreground hover:text-foreground border border-border-strong transition-colors cursor-pointer flex items-center gap-0.5"
                          title="Add Sub-scene (e.g. 4A, 4B)"
                        >
                          <Plus className="size-2.5" />
                          <span>Sub</span>
                        </button>
                      </div>
                    </div>

                    {/* Slugline Heading */}
                    <div
                      className={`font-mono text-xs font-bold uppercase tracking-wide truncate ${
                        isSelected ? 'text-foreground' : 'text-subtle-foreground'
                      }`}
                    >
                      {s.heading || s.location_name}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: SCREENPLAY PAGE (NO FRAME IN FRAME - DIRECT HIGH-CONTRAST CANVAS) */}
        <div className="lg:col-span-8 xl:col-span-9">
          {isEditingContent && viewMode === 'SINGLE_SCENE' ? (
            /* PROFESSIONAL SCREENPLAY STUDIO EDITOR (Matches user's reference) */
            <ScreenplayEditor
              initialText={activeSceneObj?.description || activeSceneObj?.heading || ''}
              initialHeading={activeSceneObj?.heading || 'SCENE'}
              sceneNumber={activeSceneObj?.scene_number || '1'}
              theme={readerTheme}
              isSaving={isSavingContent}
              onSave={handleSaveContent}
              onCancel={() => setIsEditingContent(false)}
            />
          ) : (
            <div className="flex justify-center">
              <div
                className={`w-full max-w-[720px] transition-colors min-h-[900px] relative ${
                  readerTheme === 'WHITE'
                    ? 'bg-white text-[#111]'
                    : 'bg-[#0d0d10] text-zinc-200 border border-zinc-800'
                }`}
                style={{
                  boxShadow: readerTheme === 'WHITE'
                    ? '0 4px 40px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)'
                    : '0 4px 40px rgba(0,0,0,0.5)',
                  padding: '60px 55px 60px 75px',
                  fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
                  fontSize: fontSize === 'sm' ? '11.5px' : fontSize === 'lg' ? '13.5px' : '12.5px',
                  lineHeight: '1.65',
                }}
              >
                {/* Tiny draft watermark top */}
                <div
                  className={`absolute top-4 left-0 right-0 text-center text-[9px] font-mono uppercase tracking-[0.2em] select-none ${
                    readerTheme === 'WHITE' ? 'text-zinc-300' : 'text-zinc-700'
                  }`}
                >
                  {script.file_name.replace('.pdf', '').replace('.PDF', '')} · {colorMeta.label} Draft (v{script.version})
                </div>

                {/* Page / Scene number top-right */}
                <div
                  className={`absolute top-4 right-8 text-[10px] font-mono select-none ${
                    readerTheme === 'WHITE' ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {viewMode === 'SINGLE_SCENE'
                    ? `SCENE ${activeSceneObj?.scene_number || 1}`
                    : `${activePageNum}.`}
                </div>

                {/* Screenplay Content */}
                <div className="select-text">
                  {viewMode === 'SINGLE_SCENE' ? (
                    /* SELECTED SCENE ONLY */
                    selectedSceneLines.length === 0 ? (
                      <div
                        className={`py-24 text-center font-mono ${
                          readerTheme === 'WHITE' ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                      >
                        No content available for Scene {activeSceneObj?.scene_number}.
                      </div>
                    ) : (
                      selectedSceneLines.map((line, idx) => {
                        // Slugline / Scene Heading
                        if (line.type === 'SLUGLINE') {
                          return (
                            <div
                              key={idx}
                              className="mt-6 mb-2"
                            >
                              <div
                                className={`font-bold uppercase tracking-wide flex items-center justify-between border-b pb-0.5 ${
                                  readerTheme === 'WHITE'
                                    ? 'text-black border-transparent'
                                    : 'text-amber-400 border-transparent'
                                }`}
                              >
                                <span className="font-mono text-[90%]">{activeSceneObj?.scene_number}</span>
                                <span className="flex-1 px-3">{line.text}</span>
                                <span className="font-mono text-[90%] text-right">{activeSceneObj?.scene_number}</span>
                              </div>
                            </div>
                          )
                        }

                        // Character Cue
                        if (line.type === 'CHARACTER') {
                          return (
                            <div
                              key={idx}
                              className={`mt-4 mb-0 font-bold uppercase tracking-widest ${
                                readerTheme === 'WHITE' ? 'text-black' : 'text-white'
                              }`}
                              style={{ paddingLeft: '37%' }}
                            >
                              {line.text}
                            </div>
                          )
                        }

                        // Parenthetical
                        if (line.type === 'PARENTHETICAL') {
                          return (
                            <div
                              key={idx}
                              className={`italic ${
                                readerTheme === 'WHITE' ? 'text-zinc-700' : 'text-zinc-400'
                              }`}
                              style={{ paddingLeft: '30%', fontSize: '92%' }}
                            >
                              {line.text}
                            </div>
                          )
                        }

                        // Dialogue
                        if (line.type === 'DIALOGUE') {
                          return (
                            <div
                              key={idx}
                              className={readerTheme === 'WHITE' ? 'text-[#111]' : 'text-zinc-100'}
                              style={{ paddingLeft: '20%', paddingRight: '20%' }}
                            >
                              {line.text}
                            </div>
                          )
                        }

                        // Transitions
                        if (line.type === 'TRANSITION') {
                          return (
                            <div
                              key={idx}
                              className={`mt-3 mb-2 font-bold uppercase tracking-wider text-right ${
                                readerTheme === 'WHITE' ? 'text-zinc-800' : 'text-zinc-300'
                              }`}
                            >
                              {line.text}
                            </div>
                          )
                        }

                        // Empty Line
                        if (line.type === 'EMPTY') {
                          return <div key={idx} className="h-[1.1em]" />
                        }

                        // Action (default)
                        return (
                          <div
                            key={idx}
                            className={`my-0.5 ${
                              readerTheme === 'WHITE' ? 'text-[#111]' : 'text-zinc-300'
                            }`}
                          >
                            {line.text}
                          </div>
                        )
                      })
                    )
                  ) : (
                    /* FULL PAGE VIEW */
                    fullPageLines.length === 0 ? (
                      <div className="py-24 text-center text-zinc-400 font-mono">
                        No text extracted on Page {activePageNum}.
                      </div>
                    ) : (
                      fullPageLines.map((line, idx) => {
                        if (line.type === 'SLUGLINE') {
                          return (
                            <div
                              key={idx}
                              className="mt-6 mb-2"
                            >
                              <div
                                className={`font-bold uppercase tracking-wide flex items-center justify-between ${
                                  readerTheme === 'WHITE' ? 'text-black' : 'text-amber-400'
                                }`}
                              >
                                <span className="font-mono text-[90%]">{line.matchedSceneNumber || ''}</span>
                                <span className="flex-1 px-3">{line.text}</span>
                                <span className="font-mono text-[90%] text-right">{line.matchedSceneNumber || ''}</span>
                              </div>
                            </div>
                          )
                        }
                        if (line.type === 'CHARACTER') {
                          return (
                            <div
                              key={idx}
                              className={`mt-4 mb-0 font-bold uppercase tracking-widest ${
                                readerTheme === 'WHITE' ? 'text-black' : 'text-white'
                              }`}
                              style={{ paddingLeft: '37%' }}
                            >
                              {line.text}
                            </div>
                          )
                        }
                        if (line.type === 'PARENTHETICAL') {
                          return (
                            <div
                              key={idx}
                              className={`italic ${
                                readerTheme === 'WHITE' ? 'text-zinc-700' : 'text-zinc-400'
                              }`}
                              style={{ paddingLeft: '30%', fontSize: '92%' }}
                            >
                              {line.text}
                            </div>
                          )
                        }
                        if (line.type === 'DIALOGUE') {
                          return (
                            <div
                              key={idx}
                              className={readerTheme === 'WHITE' ? 'text-[#111]' : 'text-zinc-100'}
                              style={{ paddingLeft: '20%', paddingRight: '20%' }}
                            >
                              {line.text}
                            </div>
                          )
                        }
                        if (line.type === 'TRANSITION') {
                          return (
                            <div
                              key={idx}
                              className={`mt-3 mb-2 font-bold uppercase tracking-wider text-right ${
                                readerTheme === 'WHITE' ? 'text-zinc-800' : 'text-zinc-300'
                              }`}
                            >
                              {line.text}
                            </div>
                          )
                        }
                        if (line.type === 'EMPTY') {
                          return <div key={idx} className="h-[1.1em]" />
                        }
                        return (
                          <div
                            key={idx}
                            className={`my-0.5 ${
                              readerTheme === 'WHITE' ? 'text-[#111]' : 'text-zinc-300'
                            }`}
                          >
                            {line.text}
                          </div>
                        )
                      })
                    )
                  )}
                </div>

                {/* Page footer */}
                <div
                  className={`absolute bottom-4 left-0 right-0 text-center text-[9px] font-mono select-none ${
                    readerTheme === 'WHITE' ? 'text-zinc-300' : 'text-zinc-700'
                  }`}
                >
                  {viewMode === 'SINGLE_SCENE'
                    ? `Scene ${activeSceneObj?.scene_number} · Page ${activeSceneObj?.page_start || 1}`
                    : `Page ${activePageNum}`}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>

      {/* Add Scene Modal */}
      <AddSceneModal
        isOpen={isAddSceneOpen}
        onClose={() => setIsAddSceneOpen(false)}
        projectId={script.project_id}
        scriptId={script.id}
        nextSuggestedNumber={nextSuggestedNumber}
        onSceneCreated={handleSceneCreated}
      />

      {/* Renumber All Scenes Confirmation Modal */}
      {isRenumberModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-background border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <RefreshCw className="size-6 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Renumber All Scenes</h3>
                <p className="text-xs text-muted-foreground font-mono">Sequential Scene Breakdown</p>
              </div>
            </div>

            <div className="text-xs text-subtle-foreground space-y-2.5 leading-relaxed bg-card/70 p-4 rounded-xl border border-border">
              <p>
                <strong className="text-amber-700 dark:text-amber-400 font-bold">What is Renumber for?</strong>
                <br />
                During script revisions, when you add scenes (like <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">15 B</span>), reorder scenes, or delete scenes, the numbering becomes non-sequential.
              </p>
              <p>
                Clicking <strong>Renumber All</strong> will cleanly re-sequence all <span className="text-amber-700 dark:text-amber-400 font-bold font-mono">{scenes.length} scenes</span> sequentially from <strong className="font-mono text-foreground">1</strong> to <strong className="font-mono text-foreground">{scenes.length}</strong> to match their exact list order in this draft.
              </p>
              <p className="text-muted-foreground text-[11px] pt-1 border-t border-border/80">
                💡 <em>All scene numbers update simultaneously across your breakdown, stripboard, and call sheets.</em>
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenumberModalOpen(false)}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmRenumberAll}
                disabled={isProcessing}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
                    <span>Renumbering...</span>
                  </>
                ) : (
                  <span>Renumber 1 to {scenes.length}</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Script & Title Page Metadata Modal */}
      <ScriptMetadataModal
        isOpen={showMetadataModal}
        onClose={() => setShowMetadataModal(false)}
        script={currentScriptDoc}
        onSave={handleUpdateMetadata}
      />

      {/* Keyboard Shortcuts Reference Modal */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  )
}
