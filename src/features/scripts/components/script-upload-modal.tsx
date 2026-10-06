'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { useFeedback } from '@/components/ui/feedback-provider'
import {
  startScriptUploadAction,
  syncUploadedScenesAction,
  linkUploadedScriptAction,
  finishScriptUploadAction,
} from '@/features/scripts/actions'
import type { ParsedScene } from '@/features/scripts/lib/parser'
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
  Circle,
  MinusCircle,
  RotateCcw,
} from 'lucide-react'

type StepId = 'upload' | 'scenes' | 'links' | 'finish'
type StepStatus = 'pending' | 'active' | 'done' | 'error' | 'skipped'
type StepState = { status: StepStatus; detail?: string }

const STEPS: Array<{ id: StepId; label: string; activeLabel: string }> = [
  { id: 'upload', label: 'Upload & read script', activeLabel: 'Uploading the file and reading its pages…' },
  { id: 'scenes', label: 'Update scenes & speaking characters', activeLabel: 'Matching scenes to the previous draft…' },
  { id: 'links', label: 'Link cast & locations to Cast & Crew', activeLabel: 'Linking breakdown items…' },
  { id: 'finish', label: 'Update bookings & finish', activeLabel: 'Notifying the team…' },
]

const initialSteps = (): Record<StepId, StepState> => ({
  upload: { status: 'pending' },
  scenes: { status: 'pending' },
  links: { status: 'pending' },
  finish: { status: 'pending' },
})

interface ScriptUploadModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  suggestedVersion?: number
  suggestedColor?: RevisionColor
  /** A current draft exists, so the new one can be compared with it before applying */
  hasCurrentDraft?: boolean
}

/** What happens to the project's scenes when a new draft arrives */
type ApplyMode = 'review' | 'now' | 'store'

export function ScriptUploadModal({
  projectId,
  isOpen,
  onClose,
  suggestedVersion = 1,
  suggestedColor = 'WHITE',
  hasCurrentDraft = false,
}: ScriptUploadModalProps) {
  const router = useRouter()
  const { notify } = useFeedback()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [version, setVersion] = useState<number>(suggestedVersion)
  const [selectedColor, setSelectedColor] = useState<RevisionColor>(suggestedColor)
  const [isCurrent, setIsCurrent] = useState(true)
  const [applyMode, setApplyMode] = useState<ApplyMode>('review')

  // The upload runs as short server steps (each well inside the host's time limit);
  // progress is shown between them and a failed step can be retried without re-uploading.
  const [steps, setSteps] = useState<Record<StepId, StepState>>(initialSteps)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<{ step: StepId; message: string } | null>(null)
  const [linkProgress, setLinkProgress] = useState<{ done: number; total: number } | null>(null)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const formDataRef = useRef<FormData | null>(null)
  const uploadRef = useRef<{
    documentId: string
    becomesCurrent: boolean
    previousCurrentId: string | null
    scenes: ParsedScene[]
  } | null>(null)

  const started = startedAt !== null
  const handleClose = () => {
    if (running) return
    setSteps(initialSteps())
    setError(null)
    setLinkProgress(null)
    setStartedAt(null)
    uploadRef.current = null
    onClose()
  }
  useModalBehavior(isOpen, handleClose)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  if (!isOpen) return null

  const setStep = (id: StepId, status: StepStatus, detail?: string) =>
    setSteps((prev) => ({ ...prev, [id]: { status, detail } }))

  const reviewing = hasCurrentDraft && applyMode === 'review'

  const runFrom = async (first: StepId) => {
    setRunning(true)
    setError(null)
    let current: StepId = first
    const fail = (message: string) => {
      setStep(current, 'error')
      setError({ step: current, message })
    }
    const order: StepId[] = ['upload', 'scenes', 'links', 'finish']
    try {
      for (const id of order.slice(order.indexOf(first))) {
        // A draft that isn't made current leaves the project's scenes alone
        if ((id === 'scenes' || id === 'links') && uploadRef.current && !uploadRef.current.becomesCurrent) continue
        current = id
        setStep(id, 'active')

        if (id === 'upload') {
          const res = await startScriptUploadAction(projectId, formDataRef.current!)
          if ('error' in res) return fail(res.error)
          uploadRef.current = res
          setStep('upload', 'done', `${res.totalPages} page${res.totalPages === 1 ? '' : 's'} · ${res.scenes.length} scene${res.scenes.length === 1 ? '' : 's'} found`)
          if (!res.becomesCurrent) {
            setStep(
              'scenes',
              'skipped',
              reviewing ? 'You will review the changes next — nothing in the app changes until you apply them' : 'Not the current draft, so project scenes are unchanged'
            )
            setStep('links', 'skipped')
          }
        }

        const upload = uploadRef.current!

        if (id === 'scenes') {
          const res = await syncUploadedScenesAction(projectId, upload.documentId, upload.scenes)
          if ('error' in res) return fail(res.error)
          const omitted = res.omitted.length ? ` · ${res.omitted.length} not in this draft` : ''
          setStep('scenes', 'done', `${res.added} new · ${res.changed} changed${omitted}`)
        }

        if (id === 'links') {
          let done = 0
          let total = 0
          let stalls = 0
          for (;;) {
            const res = await linkUploadedScriptAction(projectId)
            if ('error' in res) return fail(res.error)
            done += res.linked
            total = Math.max(total, done + res.remaining)
            setLinkProgress({ done, total })
            if (res.remaining === 0) break
            stalls = res.linked === 0 ? stalls + 1 : 0
            if (stalls >= 2) return fail(`${res.remaining} breakdown items could not be linked. Retry, or open the Breakdown to finish linking.`)
          }
          setStep('links', 'done', total ? `${total} item${total === 1 ? '' : 's'} linked` : 'Everything was already linked')
        }

        if (id === 'finish') {
          const res = await finishScriptUploadAction(projectId, upload.documentId)
          if (res.error) return fail(res.error)
          setStep('finish', 'done')
        }
      }
    } catch (err) {
      return fail(err instanceof Error ? err.message : 'The connection to the server was lost.')
    } finally {
      setRunning(false)
    }

    const upload = uploadRef.current
    if (reviewing && upload && !upload.becomesCurrent && upload.previousCurrentId) {
      notify('Draft uploaded — review what changed, then apply', 'success')
      handleCloseAfterSuccess()
      router.push(`/projects/${projectId}/scripts/${upload.documentId}?tab=compare&base=${upload.previousCurrentId}`)
      return
    }
    notify('Script uploaded and processed', 'success')
    router.refresh()
    handleCloseAfterSuccess()
  }

  const handleCloseAfterSuccess = () => {
    setSteps(initialSteps())
    setLinkProgress(null)
    setStartedAt(null)
    setSelectedFile(null)
    uploadRef.current = null
    onClose()
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFile || running) return
    const fd = new FormData(e.currentTarget)
    fd.set('file', selectedFile) // dropped files never reach the hidden input
    // Reviewing first: the new draft only becomes current when its changes are applied
    if (hasCurrentDraft) fd.set('isCurrent', applyMode === 'now' ? 'true' : 'false')
    formDataRef.current = fd
    setSteps(initialSteps())
    setLinkProgress(null)
    setStartedAt(Date.now())
    setNow(Date.now())
    void runFrom('upload')
  }

  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0

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
          disabled={running}
          onClick={handleClose}
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

        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error.message}</span>
          </div>
        )}

        {started && (
          <div className="space-y-4" aria-live="polite">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/40">
              <FileText className="size-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{selectedFile?.name}</div>
                <div className="text-xs text-muted-foreground">
                  v{version} · {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
                </div>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">{elapsed}s</span>
            </div>

            <ol className="space-y-3">
              {STEPS.map((step) => {
                const st = steps[step.id]
                const showBar = step.id === 'links' && linkProgress && linkProgress.total > 0 && st.status !== 'skipped'
                return (
                  <li key={step.id} className="flex items-start gap-3">
                    <span className="mt-0.5 shrink-0">
                      {st.status === 'done' && <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-400" />}
                      {st.status === 'active' && <Loader2 className="size-4 animate-spin text-amber-700 dark:text-amber-400" />}
                      {st.status === 'error' && <AlertCircle className="size-4 text-red-700 dark:text-red-400" />}
                      {st.status === 'skipped' && <MinusCircle className="size-4 text-muted-foreground" />}
                      {st.status === 'pending' && <Circle className="size-4 text-muted-foreground/50" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${st.status === 'pending' || st.status === 'skipped' ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                        {step.label}
                      </div>
                      {(st.detail || st.status === 'active') && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {st.status === 'active'
                            ? step.id === 'links' && linkProgress
                              ? `${linkProgress.done} of ${linkProgress.total} linked…`
                              : step.activeLabel
                            : st.detail}
                        </div>
                      )}
                      {showBar && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all duration-500"
                            style={{ width: `${Math.round((linkProgress.done / linkProgress.total) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className="border-t border-border/80 pt-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={running}
                onClick={handleClose}
                className="border-border text-muted-foreground hover:text-foreground text-xs h-9 cursor-pointer"
              >
                Close
              </Button>
              {error ? (
                <Button
                  type="button"
                  onClick={() => void runFrom(error.step)}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-5 text-xs h-9 cursor-pointer"
                >
                  <RotateCcw className="size-3.5 mr-1.5" />
                  Retry {STEPS.find((s) => s.id === error.step)?.label.toLowerCase()}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Keep this window open until it finishes.</span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={started ? 'hidden' : 'space-y-6'}>
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

          {/* What happens to the app's scenes */}
          {hasCurrentDraft ? (
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-foreground mb-1.5">When this draft has changes</legend>
              {(
                [
                  ['review', 'Review the changes first (recommended)', 'Opens this draft next to the current one, word by word. Nothing in the app changes until you apply — all at once or scene by scene.'],
                  ['now', 'Apply all changes now', 'Scenes, breakdown and schedule follow this draft straight away. You can still compare the drafts afterwards.'],
                  ['store', 'Just store it', 'Keep it as a reference draft. The app keeps following the current draft.'],
                ] as const
              ).map(([mode, title, hint]) => (
                <label
                  key={mode}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    applyMode === mode ? 'border-amber-500/60 bg-amber-500/5' : 'border-border bg-card/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="applyMode"
                    value={mode}
                    checked={applyMode === mode}
                    onChange={() => setApplyMode(mode)}
                    className="mt-0.5 accent-amber-500 cursor-pointer"
                  />
                  <span className="text-xs text-subtle-foreground">
                    <strong className="text-foreground block font-medium">{title}</strong>
                    {hint}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
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
          )}

          {/* Modal Footer */}
          <div className="border-t border-border/80 pt-4 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="border-border text-muted-foreground hover:text-foreground text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={running || !selectedFile}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold px-5 text-xs h-9 shadow-lg shadow-amber-500/15 cursor-pointer disabled:opacity-50"
            >
              <Upload className="size-3.5 mr-1.5" />
              Upload & Ingest Script
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
