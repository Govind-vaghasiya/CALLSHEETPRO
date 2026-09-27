'use client'

import React, { useState } from 'react'
import { useFeedback } from '@/components/ui/feedback-provider'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import type { RevisionColor } from '../types'
import { saveScheduleVersionAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, Layers, X, Check, Save } from 'lucide-react'

interface CreateVersionModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onVersionSaved: () => void
}

const REVISION_COLORS: { color: RevisionColor; label: string; badgeClass: string }[] = [
  { color: 'WHITE', label: 'White Draft', badgeClass: 'bg-white text-zinc-950 border-zinc-300' },
  { color: 'BLUE', label: 'Blue Revision', badgeClass: 'bg-blue-600 text-white border-blue-500' },
  { color: 'PINK', label: 'Pink Revision', badgeClass: 'bg-pink-500 text-white border-pink-400' },
  { color: 'YELLOW', label: 'Yellow Revision', badgeClass: 'bg-amber-400 text-zinc-950 border-amber-300' },
  { color: 'GREEN', label: 'Green Revision', badgeClass: 'bg-emerald-500 text-zinc-950 border-emerald-400' },
  { color: 'GOLDENROD', label: 'Goldenrod Draft', badgeClass: 'bg-yellow-600 text-white border-yellow-500' },
  { color: 'BUFF', label: 'Buff Revision', badgeClass: 'bg-amber-200 text-amber-950 border-amber-300' },
  { color: 'SALMON', label: 'Salmon Revision', badgeClass: 'bg-rose-400 text-zinc-950 border-rose-300' },
  { color: 'CHERRY', label: 'Cherry Draft', badgeClass: 'bg-red-700 text-white border-red-600' },
  { color: 'TAN', label: 'Tan Revision', badgeClass: 'bg-stone-400 text-stone-950 border-stone-300' },
]

export function CreateVersionModal({
  isOpen,
  onClose,
  projectId,
  onVersionSaved,
}: CreateVersionModalProps) {
  const { notify } = useFeedback()
  useModalBehavior(isOpen, onClose)
  const [versionName, setVersionName] = useState('')
  const [selectedColor, setSelectedColor] = useState<RevisionColor>('WHITE')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    const res = await saveScheduleVersionAction(
      projectId,
      versionName || `v1.${Date.now().toString().slice(-3)} ${selectedColor}`,
      selectedColor,
      notes
    )
    setIsSaving(false)

    if (res.success) {
      onVersionSaved()
      onClose()
      setVersionName('')
      setNotes('')
    } else {
      notify(res.error || 'Failed to save schedule snapshot', 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-2 font-mono font-bold text-foreground text-sm">
            <Camera className="size-4 text-amber-700 dark:text-amber-400" />
            <span>Create Schedule Version Snapshot</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 font-mono text-xs">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground font-bold uppercase">
              Version Name / Tag
            </label>
            <Input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g. v1.1 Official Blue Revision, Locked Pre-Prod..."
              className="bg-card border-border text-foreground font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground font-bold uppercase">
              Hollywood Revision Color Tag
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
              {REVISION_COLORS.map((item) => (
                <button
                  key={item.color}
                  type="button"
                  onClick={() => setSelectedColor(item.color)}
                  className={`p-2 rounded-xl border text-[10px] font-mono font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                    item.badgeClass
                  } ${
                    selectedColor === item.color
                      ? 'ring-2 ring-amber-400 scale-[1.02]'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {selectedColor === item.color && <Check className="size-3 shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground font-bold uppercase">
              Snapshot Release Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Schedule locked prior to Day 1 shooting. Moved Stunt scenes to Day 3..."
              className="w-full bg-card border border-border rounded-xl p-3 text-foreground text-xs font-mono outline-none focus:border-amber-500 placeholder:text-faint"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:text-foreground text-xs font-mono h-8 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono h-8 cursor-pointer"
            >
              <Save className="size-3.5 mr-1" />
              <span>{isSaving ? 'Saving Snapshot...' : 'Save Snapshot'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
