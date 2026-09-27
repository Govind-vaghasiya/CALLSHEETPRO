'use client'

import React, { useState, useActionState, useTransition } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import {
  uploadScriptAction,
  type ScriptActionState,
} from '@/features/scripts/actions'
import {
  REVISION_COLORS,
  getRevisionColorMeta,
} from '@/features/scripts/lib/revision-colors'
import type { RevisionColor } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'

interface ScriptUploadModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  suggestedVersion?: number
  suggestedColor?: RevisionColor
}

export function ScriptUploadModal({
  projectId,
  isOpen,
  onClose,
  suggestedVersion = 1,
  suggestedColor = 'WHITE',
}: ScriptUploadModalProps) {
  useModalBehavior(isOpen, onClose)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [version, setVersion] = useState<number>(suggestedVersion)
  const [selectedColor, setSelectedColor] = useState<RevisionColor>(suggestedColor)
  const [isCurrent, setIsCurrent] = useState(true)

  const uploadActionWithProject = uploadScriptAction.bind(null, projectId)
  const [state, formAction, isPending] = useActionState<ScriptActionState, FormData>(
    uploadActionWithProject,
    {}
  )

  if (!isOpen) return null

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const colorList = Object.values(REVISION_COLORS)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background p-6 shadow-2xl space-y-6 relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          type="button"
          disabled={isPending}
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-card disabled:opacity-50 cursor-pointer"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {/* Modal Header */}
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono uppercase font-semibold mb-1">
            <Sparkles className="size-4" /> Screenplay Ingestion Engine
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Upload Screenplay Draft
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Import Final Draft (.fdx), PDF, or Fountain. Automatic scene slugline extraction, page count, and revision logging.
          </p>
        </div>

        {state?.error && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        <form action={formAction} className="space-y-6">
          {/* File Dropzone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
              dragActive
                ? 'border-amber-500 bg-amber-500/10'
                : selectedFile
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : 'border-border bg-card/40 hover:border-border-strong'
            }`}
          >
            <input
              id="file"
              name="file"
              type="file"
              accept=".pdf,.fdx,.txt,.fountain"
              onChange={handleFileChange}
              className="sr-only"
              required
            />
            <label htmlFor="file" className="cursor-pointer block">
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="size-11 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <FileText className="size-6" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground truncate max-w-sm">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB · Click or drag to change
                    </div>
                  </div>
                  <CheckCircle2 className="size-5 text-emerald-700 dark:text-emerald-400 ml-2" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="size-12 rounded-xl bg-card border border-border text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
                    <Upload className="size-6" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">
                      Click to browse or drop screenplay file here
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports Final Draft (.fdx), Screenplay PDF (.pdf), and Fountain (.fountain, .txt)
                    </p>
                  </div>
                </div>
              )}
            </label>
          </div>

          {/* Dual Version & Revision Color Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/80">
            {/* Version Number */}
            <div className="space-y-2">
              <Label htmlFor="version" className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Version Number</span>
                <span className="text-[11px] font-mono text-amber-700 dark:text-amber-400">
                  Label: v{version}
                </span>
              </Label>
              <Input
                id="version"
                name="version"
                type="number"
                min={1}
                max={99}
                value={version}
                onChange={(e) => setVersion(Number(e.target.value) || 1)}
                required
                className="bg-background border-border focus-visible:ring-amber-500 text-foreground font-mono h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Sequential draft iteration (e.g. 1, 2, 3).
              </p>
            </div>

            {/* Revision Date */}
            <div className="space-y-2">
              <Label htmlFor="revisionDate" className="text-xs font-medium text-foreground">
                Revision / Issue Date
              </Label>
              <Input
                id="revisionDate"
                name="revisionDate"
                type="date"
                defaultValue={todayStr}
                required
                className="bg-background border-border focus-visible:ring-amber-500 text-foreground h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Official distribution date stamped on pages.
              </p>
            </div>
          </div>

          {/* Hollywood Revision Color Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-foreground">
                Hollywood Revision Color
              </Label>
              <span className="text-[11px] font-mono text-muted-foreground">
                Active: <strong className="text-foreground">{getRevisionColorMeta(selectedColor).label}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {colorList.map((meta) => {
                const isSelected = selectedColor === meta.color
                return (
                  <button
                    key={meta.color}
                    type="button"
                    onClick={() => setSelectedColor(meta.color)}
                    className={`p-2 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? `${meta.pillBg} ${meta.pillBorder} ring-1 ring-amber-500`
                        : 'border-border/80 bg-card/30 hover:border-border-strong'
                    }`}
                  >
                    <span className={`size-3 rounded-full shrink-0 ${meta.dotBg}`} />
                    <div className="truncate">
                      <div className={`text-xs font-medium ${isSelected ? 'text-foreground' : 'text-subtle-foreground'}`}>
                        {meta.label.split(' ')[0]}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {meta.desc}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <input type="hidden" name="revisionColor" value={selectedColor} />
          </div>

          {/* Revision Notes / Changelog */}
          <div className="space-y-2">
            <Label htmlFor="revisionNotes" className="text-xs font-medium text-foreground">
              Revision Notes & Changelog (Optional)
            </Label>
            <textarea
              id="revisionNotes"
              name="revisionNotes"
              rows={2}
              placeholder="e.g. Dialogue updates in Scene 4. Added evening courtyard exterior for climax..."
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            />
          </div>

          {/* Set as Active Draft Switch */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/40">
            <input
              id="isCurrent"
              name="isCurrent"
              type="checkbox"
              value="true"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="size-4 rounded border-border-strong bg-background text-amber-600 dark:text-amber-500 focus:ring-amber-500 cursor-pointer"
            />
            <Label htmlFor="isCurrent" className="text-xs text-subtle-foreground cursor-pointer select-none">
              <strong className="text-foreground block font-medium">Set as Current Production Script</strong>
              Syncs newly detected scenes and page lengths across schedules and call sheets.
            </Label>
          </div>

          {/* Modal Footer */}
          <div className="border-t border-border/80 pt-4 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={onClose}
              className="border-border text-muted-foreground hover:text-foreground text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isPending || !selectedFile}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-5 text-xs h-9 shadow-lg shadow-amber-500/15 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Parsing Scenes & Pages...
                </>
              ) : (
                <>
                  <Upload className="size-3.5 mr-1.5" />
                  Upload & Ingest Script
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
