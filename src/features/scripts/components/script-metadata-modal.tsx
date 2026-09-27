'use client'

import React, { useState } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { X, FileText, Check, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ScriptDocumentWithStats } from '../actions'
import { REVISION_COLORS_ORDERED, getRevisionColorMeta } from '../lib/revision-colors'
import type { RevisionColor } from '@/types/database'

interface ScriptMetadataModalProps {
  isOpen: boolean
  onClose: () => void
  script: ScriptDocumentWithStats
  onSave: (updated: {
    fileName: string
    version: number
    revisionColor: RevisionColor
    revisionNotes?: string
  }) => Promise<void>
}

export function ScriptMetadataModal({
  isOpen,
  onClose,
  script,
  onSave,
}: ScriptMetadataModalProps) {
  useModalBehavior(isOpen, onClose)
  const [fileName, setFileName] = useState(script.file_name.replace(/\.pdf$/i, ''))
  const [version, setVersion] = useState(script.version || 1)
  const [revisionColor, setRevisionColor] = useState<RevisionColor>(script.revision_color || 'WHITE')
  const [revisionNotes, setRevisionNotes] = useState(script.revision_notes || '')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    await onSave({
      fileName: fileName.trim().endsWith('.pdf') ? fileName.trim() : `${fileName.trim()}.pdf`,
      version: Number(version) || 1,
      revisionColor,
      revisionNotes: revisionNotes.trim(),
    })
    setIsSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-background border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <FileText className="size-5" />
            <h3 className="text-base font-bold text-foreground">Script & Title Metadata</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4 text-xs font-mono">
          <div className="space-y-1.5">
            <label className="text-muted-foreground uppercase tracking-wider text-[11px]">
              Script Title
            </label>
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. SOCFINALSCRIPT"
              className="bg-card border-border text-foreground font-sans"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-muted-foreground uppercase tracking-wider text-[11px]">
                Draft Version
              </label>
              <Input
                type="number"
                min="1"
                value={version}
                onChange={(e) => setVersion(Number(e.target.value))}
                className="bg-card border-border text-foreground font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-muted-foreground uppercase tracking-wider text-[11px]">
                Revision Color
              </label>
              <select
                value={revisionColor}
                onChange={(e) => setRevisionColor(e.target.value as RevisionColor)}
                className="w-full h-9 px-2.5 rounded-md bg-card border border-border text-foreground text-xs font-mono outline-none focus:border-amber-500"
              >
                {REVISION_COLORS_ORDERED.map((color: RevisionColor) => {
                  const meta = getRevisionColorMeta(color)
                  return (
                    <option key={color} value={color}>
                      {meta.label} Draft
                    </option>
                  )
                })}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-muted-foreground uppercase tracking-wider text-[11px]">
              Revision Notes / Log
            </label>
            <textarea
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="e.g. Added Scene 15B, revised dialogue in Scene 4..."
              rows={3}
              className="w-full p-2.5 rounded-md bg-card border border-border text-foreground text-xs font-sans resize-none outline-none focus:border-amber-500"
            />
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:text-foreground text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer"
            >
              <Save className="size-3.5 mr-1" />
              <span>{isSaving ? 'Saving...' : 'Update Details'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
