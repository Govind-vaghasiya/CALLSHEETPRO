'use client'

import React from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { X, Keyboard, Command } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

const SHORTCUT_GROUPS = [
  {
    category: 'Screenplay Elements',
    shortcuts: [
      { key: 'Tab', desc: 'Cycle element (Action → Character → Dialogue → Parenthetical...)' },
      { key: 'Enter', desc: 'Smart next element (Character → Dialogue, Scene Heading → Action)' },
      { key: '+ INT.', desc: 'Quickly set Interior Scene Heading' },
      { key: '+ EXT.', desc: 'Quickly set Exterior Scene Heading' },
      { key: '+ (Dir)', desc: 'Add actor direction / parenthetical' },
    ],
  },
  {
    category: 'Smart Editing & Navigation',
    shortcuts: [
      { key: 'Backspace', desc: 'Delete empty block and jump focus to previous block' },
      { key: '↑ Arrow', desc: 'Navigate to line above' },
      { key: '↓ Arrow', desc: 'Navigate to line below' },
      { key: 'Cmd + /', desc: 'Toggle keyboard shortcuts reference' },
    ],
  },
  {
    category: 'Production & Breakdown',
    shortcuts: [
      { key: '# Pos', desc: 'Jump scene directly to position (e.g. #15)' },
      { key: '🔒 Lock', desc: 'Freeze scene numbers for production draft' },
      { key: 'Renumber', desc: 'Sequentially renumber all scenes 1 to N' },
      { key: '+ Sub', desc: 'Create subscene (e.g. 15 → 15A, 15B)' },
    ],
  },
]

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useModalBehavior(isOpen, onClose)
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-background border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <Keyboard className="size-5" />
            <h3 className="text-base font-bold text-foreground">Screenplay Studio Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
                {group.category}
              </div>
              <div className="bg-card/60 rounded-xl border border-border/80 divide-y divide-border/40">
                {group.shortcuts.map((sc, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                    <span className="text-subtle-foreground">{sc.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-muted border border-border-strong text-amber-700 dark:text-amber-400 font-mono text-[11px] font-bold shadow-sm">
                      {sc.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-subtle-foreground">Esc</kbd> to close</span>
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
