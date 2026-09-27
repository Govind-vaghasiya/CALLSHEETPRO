'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  type ScreenplayBlockType,
  type ScriptBlock,
  parseTextToBlocks,
  serializeBlocksToText,
  getNextBlockType,
  cycleBlockType,
} from '../lib/screenplay-editor-utils'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  Check,
  Save,
  X,
  Code,
  FileText,
} from 'lucide-react'

interface ScreenplayEditorProps {
  initialText: string
  initialHeading: string
  sceneNumber: string
  theme?: 'WHITE' | 'DARK'
  isSaving?: boolean
  onSave: (heading: string, description: string) => Promise<void>
  onCancel: () => void
}

const ELEMENT_TYPES: { type: ScreenplayBlockType; label: string; shortcut: string }[] = [
  { type: 'SCENE_HEADING', label: 'Scene Heading', shortcut: 'INT./EXT.' },
  { type: 'ACTION', label: 'Action', shortcut: 'Alt+A' },
  { type: 'CHARACTER', label: 'Character', shortcut: 'Alt+C' },
  { type: 'PARENTHETICAL', label: 'Parenthetical', shortcut: 'Alt+P' },
  { type: 'DIALOGUE', label: 'Dialogue', shortcut: 'Alt+D' },
  { type: 'TRANSITION', label: 'Transition', shortcut: 'Alt+T' },
  { type: 'SHOT', label: 'Shot', shortcut: 'Alt+S' },
  { type: 'CENTERED', label: 'Centered', shortcut: 'Alt+M' },
]

export function ScreenplayEditor({
  initialText,
  initialHeading,
  sceneNumber,
  theme = 'WHITE',
  isSaving = false,
  onSave,
  onCancel,
}: ScreenplayEditorProps) {
  // Blocks state
  const [blocks, setBlocks] = useState<ScriptBlock[]>(() =>
    parseTextToBlocks(initialText, sceneNumber, initialHeading)
  )
  const [activeBlockId, setActiveBlockId] = useState<string>(blocks[0]?.id || '')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showSceneNumbers, setShowSceneNumbers] = useState(true)
  const [isRawMode, setIsRawMode] = useState(false)
  const [rawText, setRawText] = useState(initialText)

  // Block inputs ref
  const blockInputRefs = useRef<{ [key: string]: HTMLTextAreaElement | null }>({})
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Current active block
  const activeBlock = blocks.find((b) => b.id === activeBlockId) || blocks[0]

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-resize textarea when text changes
  const adjustHeight = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  // Adjust all textarea heights on render
  useEffect(() => {
    Object.values(blockInputRefs.current).forEach((el) => {
      if (el) adjustHeight(el)
    })
  }, [blocks])

  // Update block text
  const handleUpdateText = (id: string, text: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b
        const formatted =
          b.type === 'CHARACTER' || b.type === 'SCENE_HEADING' || b.type === 'TRANSITION'
            ? text.toUpperCase()
            : text
        return { ...b, text: formatted }
      })
    )
  }

  // Change block type
  const handleChangeType = (id: string, newType: ScreenplayBlockType) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b
        let txt = b.text
        if (newType === 'CHARACTER') {
          txt = txt.toUpperCase().replace(/[.!?,;:]/g, '').trim()
        } else if (newType === 'SCENE_HEADING') {
          txt = txt.toUpperCase()
          if (!txt.startsWith('INT.') && !txt.startsWith('EXT.') && !txt.startsWith('INT/EXT.')) {
            txt = `INT. ${txt}`.trim()
          }
        } else if (newType === 'PARENTHETICAL') {
          const inner = txt.replace(/^\(+|\)+$/g, '').trim()
          txt = `(${inner})`
        } else if (newType === 'TRANSITION') {
          txt = txt.toUpperCase()
          if (!txt.endsWith(':')) txt = `${txt}:`
        }
        return { ...b, type: newType, text: txt }
      })
    )
    setIsDropdownOpen(false)
    setTimeout(() => blockInputRefs.current[id]?.focus(), 20)
  }

  // Add block at index
  const handleAddBlock = (index: number, type: ScreenplayBlockType = 'ACTION', text = '') => {
    const newBlock: ScriptBlock = {
      id: crypto.randomUUID(),
      type,
      text,
    }
    const copy = [...blocks]
    copy.splice(index + 1, 0, newBlock)
    setBlocks(copy)
    setActiveBlockId(newBlock.id)

    setTimeout(() => {
      const el = blockInputRefs.current[newBlock.id]
      if (el) {
        el.focus()
        adjustHeight(el)
      }
    }, 20)
  }

  // Delete block
  const handleDeleteBlock = (id: string) => {
    if (blocks.length <= 1) {
      setBlocks([{ id: crypto.randomUUID(), type: 'ACTION', text: '' }])
      return
    }
    const idx = blocks.findIndex((b) => b.id === id)
    const nextActive = blocks[idx - 1] || blocks[idx + 1]
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (nextActive) {
      setActiveBlockId(nextActive.id)
      setTimeout(() => {
        const el = blockInputRefs.current[nextActive.id]
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      }, 20)
    }
  }

  // Keyboard navigation & smart screenplay typing (Celtx / Final Draft behavior)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, block: ScriptBlock, index: number) => {
    // TAB: Cycle element type (Scene Heading -> Action -> Character -> Parenthetical -> Dialogue -> Transition)
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextType = cycleBlockType(block.type)
      handleChangeType(block.id, nextType)
      return
    }

    // ENTER: Smart next line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // If pressing Enter on empty Dialogue, switch to Action
      if (block.type === 'DIALOGUE' && !block.text.trim()) {
        handleChangeType(block.id, 'ACTION')
        return
      }
      const nextType = getNextBlockType(block.type)
      handleAddBlock(index, nextType)
      return
    }

    // BACKSPACE at start of line
    if (e.key === 'Backspace' && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      if (!block.text.trim() && blocks.length > 1) {
        e.preventDefault()
        handleDeleteBlock(block.id)
        return
      }
    }

    // UP ARROW: Move focus to previous line
    if (e.key === 'ArrowUp' && index > 0) {
      const el = e.currentTarget
      const isTopLine = el.selectionStart === 0 || !el.value.slice(0, el.selectionStart).includes('\n')
      if (isTopLine) {
        e.preventDefault()
        const prevBlock = blocks[index - 1]
        setActiveBlockId(prevBlock.id)
        const prevEl = blockInputRefs.current[prevBlock.id]
        if (prevEl) {
          prevEl.focus()
          prevEl.setSelectionRange(prevEl.value.length, prevEl.value.length)
        }
        return
      }
    }

    // DOWN ARROW: Move focus to next line
    if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      const el = e.currentTarget
      const isBottomLine = el.selectionStart === el.value.length || !el.value.slice(el.selectionStart).includes('\n')
      if (isBottomLine) {
        e.preventDefault()
        const nextBlock = blocks[index + 1]
        setActiveBlockId(nextBlock.id)
        const nextEl = blockInputRefs.current[nextBlock.id]
        if (nextEl) {
          nextEl.focus()
          nextEl.setSelectionRange(0, 0)
        }
        return
      }
    }
  }

  // Quick Action Helpers
  const handleInsertSlugPrefix = (prefix: 'INT.' | 'EXT.') => {
    if (!activeBlock) return
    const current = activeBlock.text.replace(/^(INT\.|EXT\.|INT\/EXT\.)\s*/i, '').trim()
    const newText = `${prefix} ${current}`.toUpperCase()
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === activeBlock.id ? { ...b, type: 'SCENE_HEADING', text: newText } : b
      )
    )
    setTimeout(() => blockInputRefs.current[activeBlock.id]?.focus(), 20)
  }

  // Save Handler
  const handleSave = async () => {
    if (isRawMode) {
      const parsed = parseTextToBlocks(rawText, sceneNumber)
      const serialized = serializeBlocksToText(parsed)
      await onSave(serialized.heading, rawText)
    } else {
      const serialized = serializeBlocksToText(blocks)
      await onSave(serialized.heading, serialized.description)
    }
  }

  // Toggle Raw / Visual Mode
  const toggleRawMode = () => {
    if (!isRawMode) {
      const serialized = serializeBlocksToText(blocks)
      setRawText(serialized.description)
      setIsRawMode(true)
    } else {
      const parsed = parseTextToBlocks(rawText, sceneNumber)
      setBlocks(parsed)
      setIsRawMode(false)
    }
  }

  const isDark = theme === 'DARK'

  return (
    <div className="w-full space-y-4">
      {/* CELTX / FINAL DRAFT STYLE STUDIO TOOLBAR */}
      <div
        className={`sticky top-2 z-30 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl shadow-lg border backdrop-blur-md transition-all ${
          isDark
            ? 'bg-zinc-900/95 border-zinc-800 text-zinc-100'
            : 'bg-white/95 border-zinc-200 text-zinc-900 shadow-zinc-200/50'
        }`}
      >
        {/* Left: Element Type Dropdown & Quick Formats */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Element Type Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-sm ${
                isDark
                  ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-amber-400'
                  : 'bg-zinc-100 border-zinc-300 hover:bg-zinc-200 text-amber-700'
              }`}
            >
              <span>{ELEMENT_TYPES.find((t) => t.type === activeBlock?.type)?.label || 'Action'}</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </button>

            {isDropdownOpen && (
              <div
                className={`absolute left-0 top-full mt-1.5 w-56 rounded-xl border shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                  isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-900'
                }`}
              >
                <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 mb-1">
                  Element Type · <span className="text-amber-500 font-bold">Tab</span> to cycle
                </div>
                {ELEMENT_TYPES.map((elem) => {
                  const isSelected = activeBlock?.type === elem.type
                  return (
                    <button
                      key={elem.type}
                      type="button"
                      onClick={() => handleChangeType(activeBlock.id, elem.type)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 font-bold'
                          : isDark
                          ? 'hover:bg-zinc-800 text-zinc-300'
                          : 'hover:bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <Check className="size-3 stroke-[3]" />}
                        <span className={isSelected ? '' : 'pl-5'}>{elem.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono opacity-60 ${
                          isSelected ? 'text-zinc-950' : 'text-zinc-400'
                        }`}
                      >
                        {elem.shortcut}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className={`h-4 w-px mx-0.5 ${isDark ? 'bg-zinc-700/50' : 'bg-zinc-300'}`} />

          {/* Quick Element Shortcut Buttons */}
          <button
            type="button"
            onClick={() => handleInsertSlugPrefix('INT.')}
            className={`px-2 py-1 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700 text-amber-400 hover:bg-zinc-800'
                : 'bg-zinc-100 border-zinc-300 text-amber-700 hover:bg-zinc-200'
            }`}
            title="Insert INT. Heading"
          >
            INT.
          </button>
          <button
            type="button"
            onClick={() => handleInsertSlugPrefix('EXT.')}
            className={`px-2 py-1 rounded text-xs font-mono font-bold border transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-800/80 border-zinc-700 text-amber-400 hover:bg-zinc-800'
                : 'bg-zinc-100 border-zinc-300 text-amber-700 hover:bg-zinc-200'
            }`}
            title="Insert EXT. Heading"
          >
            EXT.
          </button>

          <button
            type="button"
            onClick={() => handleChangeType(activeBlock.id, 'ACTION')}
            className={`px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer ${
              activeBlock?.type === 'ACTION'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:text-black'
            }`}
          >
            Action
          </button>

          <button
            type="button"
            onClick={() => handleChangeType(activeBlock.id, 'CHARACTER')}
            className={`px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer ${
              activeBlock?.type === 'CHARACTER'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:text-black'
            }`}
          >
            Character
          </button>

          <button
            type="button"
            onClick={() => handleChangeType(activeBlock.id, 'DIALOGUE')}
            className={`px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer ${
              activeBlock?.type === 'DIALOGUE'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:text-black'
            }`}
          >
            Dialogue
          </button>

          <button
            type="button"
            onClick={() => handleChangeType(activeBlock.id, 'PARENTHETICAL')}
            className={`px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer hidden sm:block ${
              activeBlock?.type === 'PARENTHETICAL'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white'
                : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:text-black'
            }`}
          >
            Parenthetical
          </button>

          <div className={`h-4 w-px mx-0.5 hidden md:block ${isDark ? 'bg-zinc-700/50' : 'bg-zinc-300'}`} />

          {/* Scene Number Header Toggle */}
          <button
            type="button"
            onClick={() => setShowSceneNumbers(!showSceneNumbers)}
            className={`px-2 py-1 rounded text-xs font-mono border transition-colors cursor-pointer ${
              showSceneNumbers
                ? 'bg-amber-500/20 border-amber-500 text-amber-500 font-bold'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                : 'bg-zinc-100 border-zinc-300 text-zinc-600 hover:text-zinc-900'
            }`}
            title="Toggle Scene Numbers"
          >
            # {sceneNumber}
          </button>
        </div>

        {/* Right: Mode Toggle + Save & Cancel */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleRawMode}
            className={`px-2 py-1 text-xs font-mono rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
              isRawMode
                ? 'bg-indigo-500 text-white font-bold border-indigo-400'
                : isDark
                ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:text-black'
            }`}
            title="Toggle between Document Editor and Raw Text"
          >
            {isRawMode ? <FileText className="size-3.5" /> : <Code className="size-3.5" />}
            <span className="hidden sm:inline">{isRawMode ? 'Document' : 'Raw'}</span>
          </button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs h-7 cursor-pointer shadow-md"
          >
            <Save className="size-3.5 mr-1" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSaving}
            className={`text-xs h-7 cursor-pointer ${
              isDark ? 'border-zinc-800 text-zinc-400 hover:text-white' : 'border-zinc-300 text-zinc-700'
            }`}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* CELTX / FINAL DRAFT CLEAN DOCUMENT CANVAS */}
      <div className="flex justify-center w-full">
        <div
          className={`w-full max-w-[760px] rounded-lg transition-all shadow-2xl min-h-[850px] relative ${
            isDark
              ? 'screenplay-canvas-dark bg-[#0d0d10] text-zinc-100 border border-zinc-800'
              : 'screenplay-canvas bg-white text-[#111111]'
          }`}
          style={{
            padding: '60px 55px 60px 75px',
            fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
            fontSize: '12.5px',
            lineHeight: '1.65',
            boxShadow: isDark
              ? '0 4px 40px rgba(0,0,0,0.6)'
              : '0 4px 40px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          {/* Header watermark */}
          <div
            className={`absolute top-4 left-0 right-0 text-center text-[9px] font-mono uppercase tracking-[0.2em] select-none ${
              isDark ? 'text-zinc-700' : 'text-zinc-300'
            }`}
          >
            SCENE {sceneNumber} · SCREENPLAY EDITOR
          </div>

          {isRawMode ? (
            /* RAW TEXT MODE */
            <div className="space-y-3">
              <div
                className={`text-[10px] font-mono uppercase tracking-widest flex items-center justify-between pb-2 border-b ${
                  isDark ? 'text-zinc-500 border-zinc-800' : 'text-zinc-400 border-zinc-200'
                }`}
              >
                <span>Raw Screenplay Text</span>
                <span>Scene {sceneNumber}</span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={28}
                placeholder="INT. LOCATION - DAY&#10;&#10;Action line goes here...&#10;&#10;CHARACTER&#10;Dialogue line goes here..."
                className={`w-full p-4 font-mono text-sm leading-relaxed rounded-lg border outline-none resize-y ${
                  isDark
                    ? 'bg-zinc-950 text-zinc-100 border-zinc-800 focus:border-amber-500'
                    : 'bg-zinc-50 text-zinc-900 border-zinc-300 focus:border-amber-500'
                }`}
              />
            </div>
          ) : (
            /* VISUAL CELTX DOCUMENT EDITOR — pure paper writing canvas */
            <div className="space-y-1">
              {blocks.map((block, index) => {
                const isActive = activeBlockId === block.id

                // Margins & text alignments matching industry screenwriting standard (Celtx / Final Draft)
                const blockContainerClass: Record<ScreenplayBlockType, string> = {
                  SCENE_HEADING: 'mt-6 mb-2 font-bold uppercase tracking-wider text-[13px]',
                  ACTION: 'my-1',
                  CHARACTER: 'mt-4 mb-0 pl-[35%] font-bold uppercase tracking-widest',
                  PARENTHETICAL: 'my-0 pl-[28%] italic text-[92%]',
                  DIALOGUE: 'my-0 pl-[18%] pr-[18%]',
                  TRANSITION: 'mt-4 mb-2 text-right font-bold uppercase tracking-wider',
                  SHOT: 'my-1 font-bold uppercase',
                  CENTERED: 'my-1 text-center',
                }

                const placeholders: Record<ScreenplayBlockType, string> = {
                  SCENE_HEADING: 'INT. LOCATION - TIME OF DAY',
                  ACTION: 'Action description...',
                  CHARACTER: 'CHARACTER NAME',
                  PARENTHETICAL: '(direction)',
                  DIALOGUE: 'Dialogue...',
                  TRANSITION: 'CUT TO:',
                  SHOT: 'ANGLE ON -',
                  CENTERED: 'CENTERED TEXT',
                }

                return (
                  <div key={block.id} className={blockContainerClass[block.type]}>
                    {block.type === 'SCENE_HEADING' && showSceneNumbers ? (
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono text-xs select-none shrink-0 ${
                            isDark ? 'text-amber-500/70' : 'text-zinc-400'
                          }`}
                        >
                          {sceneNumber}
                        </span>
                        <textarea
                          ref={(el) => {
                            blockInputRefs.current[block.id] = el
                          }}
                          value={block.text}
                          onChange={(e) => {
                            handleUpdateText(block.id, e.target.value)
                            adjustHeight(blockInputRefs.current[block.id])
                          }}
                          onKeyDown={(e) => handleKeyDown(e, block, index)}
                          onFocus={() => setActiveBlockId(block.id)}
                          rows={1}
                          placeholder={placeholders[block.type]}
                          className={`w-full bg-transparent border-none outline-none resize-none p-0 overflow-hidden font-mono font-bold uppercase tracking-wider text-[13px] ${
                            isDark ? 'text-amber-400 placeholder:text-zinc-700' : 'text-black placeholder:text-zinc-300'
                          }`}
                        />
                        <span
                          className={`font-mono text-xs select-none shrink-0 ${
                            isDark ? 'text-amber-500/70' : 'text-zinc-400'
                          }`}
                        >
                          {sceneNumber}
                        </span>
                      </div>
                    ) : (
                      <textarea
                        ref={(el) => {
                          blockInputRefs.current[block.id] = el
                        }}
                        value={block.text}
                        onChange={(e) => {
                          handleUpdateText(block.id, e.target.value)
                          adjustHeight(blockInputRefs.current[block.id])
                        }}
                        onKeyDown={(e) => handleKeyDown(e, block, index)}
                        onFocus={() => setActiveBlockId(block.id)}
                        rows={1}
                        placeholder={placeholders[block.type]}
                        className={`w-full bg-transparent border-none outline-none resize-none p-0 overflow-hidden font-mono ${
                          block.type === 'CHARACTER'
                            ? 'font-bold uppercase tracking-widest text-[12.5px]'
                            : block.type === 'PARENTHETICAL'
                            ? 'italic text-[11.5px]'
                            : block.type === 'TRANSITION'
                            ? 'text-right font-bold uppercase'
                            : 'text-[12.5px] leading-relaxed'
                        } ${
                          isDark
                            ? 'text-zinc-100 placeholder:text-zinc-700'
                            : 'text-[#111111] placeholder:text-zinc-300'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Footer page info */}
          <div
            className={`absolute bottom-4 left-0 right-0 text-center text-[9px] font-mono select-none ${
              isDark ? 'text-zinc-700' : 'text-zinc-300'
            }`}
          >
            Scene {sceneNumber} · Press Tab to change line type · Press Enter for next line
          </div>
        </div>
      </div>
    </div>
  )
}
