'use client'

/**
 * Compare two drafts side by side, scene by scene, word by word — and apply the new draft's
 * changes to the app one scene at a time (or all at once).
 *
 * Everything the system decides can be changed here before applying: which scenes are the same
 * scene (pairing), which changes to apply, which speaking characters to add to or remove from the
 * breakdown, and whether omitted scenes are deleted.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFeedback } from '@/components/ui/feedback-provider'
import { Button } from '@/components/ui/button'
import {
  ArrowLeftRight,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Link2,
  Loader2,
  Unlink,
  AlertTriangle,
} from 'lucide-react'
import type { ScriptDocumentWithStats } from '@/features/scripts/actions'
import { linkUploadedScriptAction } from '@/features/scripts/actions'
import {
  applyDraftChangesAction,
  getDraftForCompareAction,
  getProjectSceneStateAction,
} from '@/features/scripts/compare-actions'
import {
  diffLines,
  compareDrafts,
  rowStatus,
  statusContext,
  summarize,
  NO_OVERRIDES,
  type AppState,
  type CompareRow,
  type DiffPart,
  type Draft,
  type PairOverrides,
  type ProjectSceneState,
  type RowDecision,
  type RowStatus,
} from '@/features/scripts/lib/draft-compare'
import { getRevisionColorMeta } from '@/features/scripts/lib/revision-colors'
import { formatEighths } from '@/features/breakdown/lib/one-liners'
import { classifyScreenplayLines } from '@/features/scripts/lib/screenplay-format'

interface DraftCompareViewProps {
  projectId: string
  drafts: ScriptDocumentWithStats[]
  /** The draft whose page this is (shown on the right by default) */
  scriptId: string
  /** Draft to show on the left (?base=…); defaults to the draft before the right one */
  initialBaseId?: string
}

/** What the user changed from the defaults for one row */
interface RowEdit {
  include?: boolean
  addCast?: string[]
  removeCast?: string[]
}

const draftLabel = (d: ScriptDocumentWithStats) =>
  `v${d.version} · ${getRevisionColorMeta(d.revision_color).label}${d.is_current ? ' · current' : ''}`

/** The draft before `id` (by version, then upload time) */
function previousDraft(drafts: ScriptDocumentWithStats[], id: string) {
  const sorted = [...drafts].sort((a, b) => a.version - b.version || a.created_at.localeCompare(b.created_at))
  const at = sorted.findIndex((d) => d.id === id)
  return at > 0 ? sorted[at - 1] : sorted.find((d) => d.id !== id)
}

const signedEighths = (n: number) => (n === 0 ? '' : `${n > 0 ? '+' : '−'}${formatEighths(Math.abs(n))} pg`)

export function DraftCompareView({ projectId, drafts, scriptId, initialBaseId }: DraftCompareViewProps) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()

  const [rightId, setRightId] = useState(scriptId)
  const [leftId, setLeftId] = useState(
    () => (initialBaseId && drafts.some((d) => d.id === initialBaseId) ? initialBaseId : previousDraft(drafts, scriptId)?.id) ?? scriptId
  )
  const [cache, setCache] = useState<Record<string, Draft>>({})
  const [projectScenes, setProjectScenes] = useState<ProjectSceneState[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<PairOverrides>(NO_OVERRIDES)
  const [edits, setEdits] = useState<Record<string, RowEdit>>({})
  const [changesOnly, setChangesOnly] = useState(false)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [applying, setApplying] = useState<string | null>(null)
  const rowRefs = useRef(new Map<string, HTMLElement>())

  // Load drafts (cached) and the project's scenes
  useEffect(() => {
    let cancelled = false
    const missing = [leftId, rightId].filter((id, i, all) => !cache[id] && all.indexOf(id) === i)
    if (!missing.length) return
    Promise.all(missing.map((id) => getDraftForCompareAction(projectId, id))).then((results) => {
      if (cancelled) return
      const next: Record<string, Draft> = {}
      for (const r of results) {
        if ('error' in r) {
          setLoadError(r.error)
          return
        }
        next[r.draft.id] = r.draft
      }
      setLoadError(null)
      setCache((prev) => ({ ...prev, ...next }))
    })
    return () => {
      cancelled = true
    }
  }, [projectId, leftId, rightId, cache])

  const reloadProjectScenes = useCallback(async () => {
    const res = await getProjectSceneStateAction(projectId)
    if ('error' in res) {
      notify(res.error, 'error')
      return
    }
    setProjectScenes(res.scenes)
  }, [projectId, notify])

  useEffect(() => {
    let cancelled = false
    getProjectSceneStateAction(projectId).then((res) => {
      if (cancelled) return
      if ('error' in res) setLoadError(res.error)
      else setProjectScenes(res.scenes)
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const left = cache[leftId]
  const right = cache[rightId]
  const leftDoc = drafts.find((d) => d.id === leftId)
  const rightDoc = drafts.find((d) => d.id === rightId)

  const rows = useMemo(() => (left && right ? compareDrafts(left, right, overrides) : []), [left, right, overrides])
  const summary = useMemo(() => summarize(rows), [rows])
  const statuses = useMemo(() => {
    const map = new Map<string, RowStatus>()
    if (!projectScenes || !left || !right) return map
    const ctx = statusContext(rows, projectScenes, left, right)
    for (const r of rows) map.set(r.key, rowStatus(r, ctx))
    return map
  }, [rows, projectScenes, left, right])

  const isChange = (r: CompareRow) => r.kind !== 'UNCHANGED' || r.renumbered
  const actionable = (r: CompareRow) => {
    const s = statuses.get(r.key)?.state
    return !!s && s !== 'APPLIED' && s !== 'TAKEN' && isChange(r)
  }

  /** The row's decision with the user's edits laid over the defaults */
  const decisionFor = useCallback(
    (r: CompareRow) => {
      const status = statuses.get(r.key)
      const edit = edits[r.key] || {}
      const sceneCast = new Set(status?.scene?.cast ?? [])
      const defaultInclude = status?.state === 'PENDING' && r.kind !== 'OMITTED'
      return {
        include: edit.include ?? defaultInclude,
        addCast: edit.addCast ?? r.charactersAdded.filter((c) => !sceneCast.has(c)),
        removeCast: edit.removeCast ?? [],
      }
    },
    [edits, statuses]
  )

  const changeRows = rows.filter(isChange)
  const selected = rows.filter((r) => actionable(r) && decisionFor(r).include)
  const pendingCount = rows.filter((r) => statuses.get(r.key)?.state !== 'APPLIED' && isChange(r)).length
  const appliedCount = changeRows.length - pendingCount
  const visibleRows = changesOnly ? changeRows : rows

  const setEdit = (key: string, patch: RowEdit) => setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  const resetForNewPair = () => {
    setEdits({})
    setActiveKey(null)
  }

  const scrollTo = (key: string) => {
    setActiveKey(key)
    rowRefs.current.get(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const jump = (dir: 1 | -1) => {
    if (!changeRows.length) return
    const at = activeKey ? changeRows.findIndex((r) => r.key === activeKey) : -1
    const next = changeRows[(at + dir + changeRows.length) % changeRows.length]
    scrollTo(next.key)
  }

  // n / p jump between changes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n') jump(1)
      if (e.key === 'p') jump(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ---- Pairing (editable)
  const unpairRow = (r: CompareRow) => {
    setOverrides((prev) => ({
      unpair: [...prev.unpair, r.key],
      pair: prev.pair.filter(([l, rn]) => !(l === r.left?.number && rn === r.right?.number)),
    }))
    resetForNewPair()
  }
  const pairWith = (r: CompareRow, leftNumber: string) => {
    if (!r.right) return
    setOverrides((prev) => ({
      unpair: prev.unpair.filter((k) => k !== `${leftNumber}>${r.right!.number}`),
      pair: [...prev.pair, [leftNumber, r.right!.number]],
    }))
    resetForNewPair()
  }
  const unpairedLeft = rows.filter((r) => r.kind === 'OMITTED').map((r) => r.left!.number)

  // ---- Applying
  const runApply = async (targets: CompareRow[], label: string) => {
    if (!targets.length || !left || !right) return
    const deletions = targets.filter((r) => r.kind === 'OMITTED')
    const overwrites = targets.filter((r) => statuses.get(r.key)?.state === 'EDITED')
    const scheduledDeletes = deletions.filter((r) => statuses.get(r.key)?.scene?.days.length)
    const lines = [
      `${targets.length} scene${targets.length === 1 ? '' : 's'} will follow ${rightDoc ? `v${rightDoc.version}` : 'the new draft'}.`,
      overwrites.length
        ? `Edited in the app since — these edits will be replaced: ${overwrites.map((r) => r.right?.number ?? r.left?.number).join(', ')}.`
        : '',
      deletions.length
        ? `Deleted with their breakdown${scheduledDeletes.length ? ' and schedule placement' : ''}: ${deletions.map((r) => r.left!.number).join(', ')}.`
        : '',
      'Breakdown, Cast & Crew links and schedule placement stay with each scene.',
    ].filter(Boolean)
    const ok = await confirm({
      title: label,
      message: lines.join('\n\n'),
      confirmLabel: 'Apply',
      destructive: deletions.length > 0 || overwrites.length > 0,
    })
    if (!ok) return

    const decisions: RowDecision[] = targets.map((r) => {
      const d = decisionFor(r)
      return { key: r.key, addCast: d.addCast, removeCast: d.removeCast, deleteScene: r.kind === 'OMITTED' }
    })
    setApplying('Updating scenes…')
    try {
      const res = await applyDraftChangesAction(projectId, leftId, rightId, overrides, decisions)
      if ('error' in res) {
        notify(res.error, 'error')
        return
      }
      // New breakdown items → Cast & Crew, then bookings (in short steps, like script upload)
      setApplying('Linking cast & locations…')
      for (let stalls = 0; ; ) {
        const link = await linkUploadedScriptAction(projectId)
        if ('error' in link) {
          notify(`Scenes were updated, but linking failed: ${link.error}`, 'error')
          break
        }
        if (link.remaining === 0) break
        stalls = link.linked === 0 ? stalls + 1 : 0
        if (stalls >= 2) {
          notify(`${link.remaining} breakdown items could not be linked — open the Breakdown to finish.`, 'error')
          break
        }
      }
      await reloadProjectScenes()
      setEdits({})
      const done = [
        res.updated && `${res.updated} updated`,
        res.added && `${res.added} added`,
        res.deleted && `${res.deleted} deleted`,
      ].filter(Boolean)
      notify(done.length ? `Applied: ${done.join(', ')}` : 'Nothing needed changing', 'success')
      for (const s of res.skipped) notify(`Not applied — ${s.reason}`, 'error')
      router.refresh()
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not apply the changes.', 'error')
    } finally {
      setApplying(null)
    }
  }

  // ---- Render
  if (drafts.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Upload another draft of this script to compare them side by side.
      </div>
    )
  }

  const draftSelect = (value: string, onChange: (id: string) => void, side: string) => (
    <div className="relative min-w-0 flex-1">
      <select
        aria-label={`${side} draft`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOverrides(NO_OVERRIDES)
          resetForNewPair()
        }}
        className="w-full appearance-none rounded-lg border border-border bg-card px-3 py-2 pr-8 text-xs font-mono text-foreground cursor-pointer"
      >
        {drafts.map((d) => (
          <option key={d.id} value={d.id}>
            {draftLabel(d)} — {d.file_name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  )

  const loading = !left || !right || !projectScenes

  return (
    <div className="space-y-3">
      {/* Draft pickers */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 md:flex-row md:items-center">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">Old</span>
        {draftSelect(leftId, setLeftId, 'Old')}
        <button
          type="button"
          onClick={() => {
            setLeftId(rightId)
            setRightId(leftId)
            setOverrides(NO_OVERRIDES)
            resetForNewPair()
          }}
          className="self-center rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          title="Swap drafts"
          aria-label="Swap drafts"
        >
          <ArrowLeftRight className="size-3.5" />
        </button>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">New</span>
        {draftSelect(rightId, setRightId, 'New')}
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">{loadError}</div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border p-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Reading both drafts and comparing every scene…
        </div>
      ) : leftId === rightId ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Pick two different drafts to compare.
        </div>
      ) : (
        <>
          {/* Summary + controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <SummaryChip label="changed" value={summary.changed} tone="amber" />
            <SummaryChip label="new" value={summary.added} tone="emerald" />
            <SummaryChip label="omitted" value={summary.omitted} tone="red" />
            <SummaryChip label="renumbered" value={summary.renumbered} tone="sky" />
            <span className="text-muted-foreground font-mono">
              {summary.unchanged} unchanged{signedEighths(summary.eighthsDelta) && ` · ${signedEighths(summary.eighthsDelta)}`}
            </span>
            {changeRows.length > 0 && (
              <span className="font-mono text-muted-foreground">
                · in the app: {appliedCount} of {changeRows.length} applied
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={changesOnly} onChange={(e) => setChangesOnly(e.target.checked)} className="accent-amber-500" />
                Changes only
              </label>
              <button
                type="button"
                onClick={() => jump(-1)}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Previous change (p)"
                aria-label="Previous change"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => jump(1)}
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Next change (n)"
                aria-label="Next change"
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
            {/* Scene navigator */}
            <nav className="hidden lg:block sticky top-2 self-start max-h-[calc(100vh-1rem)] overflow-y-auto rounded-xl border border-border bg-card p-1.5">
              {visibleRows.map((r) => {
                const state = statuses.get(r.key)?.state
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => scrollTo(r.key)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] font-mono cursor-pointer ${
                      activeKey === r.key ? 'bg-amber-500/15 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <KindDot row={r} />
                    <span className="truncate">{sceneLabel(r)}</span>
                    {isChange(r) && state === 'APPLIED' && <Check className="ml-auto size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                )
              })}
            </nav>

            {/* Rows */}
            <div className="space-y-2 min-w-0 pb-20">
              <div className="hidden md:grid grid-cols-2 gap-2 px-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>{leftDoc ? `${draftLabel(leftDoc)} — ${leftDoc.file_name}` : 'Old'}</span>
                <span>{rightDoc ? `${draftLabel(rightDoc)} — ${rightDoc.file_name}` : 'New'}</span>
              </div>
              {visibleRows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No differences between these drafts.
                </div>
              )}
              {visibleRows.map((r) => (
                <CompareRowView
                  key={r.key}
                  row={r}
                  status={statuses.get(r.key)}
                  decision={decisionFor(r)}
                  actionable={actionable(r)}
                  active={activeKey === r.key}
                  busy={!!applying}
                  projectId={projectId}
                  unpairedLeft={unpairedLeft}
                  oldVersion={leftDoc?.version}
                  refCallback={(el) => {
                    if (el) rowRefs.current.set(r.key, el)
                    else rowRefs.current.delete(r.key)
                  }}
                  onEdit={(patch) => setEdit(r.key, patch)}
                  onUnpair={() => unpairRow(r)}
                  onPair={(n) => pairWith(r, n)}
                  onApply={() => runApply([r], `Apply scene ${sceneLabel(r)}`)}
                />
              ))}
            </div>
          </div>

          {/* Apply bar */}
          {pendingCount > 0 && (
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
              <div className="text-xs">
                <span className="font-semibold text-foreground">{selected.length}</span>
                <span className="text-muted-foreground"> of {pendingCount} pending change{pendingCount === 1 ? '' : 's'} selected</span>
                {applying && (
                  <span className="ml-3 inline-flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> {applying}
                  </span>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={!!applying}
                  onClick={() =>
                    setEdits((prev) => {
                      const next = { ...prev }
                      for (const r of rows) if (actionable(r) && r.kind !== 'OMITTED') next[r.key] = { ...next[r.key], include: true }
                      return next
                    })
                  }
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  disabled={!!applying}
                  onClick={() =>
                    setEdits((prev) => {
                      const next = { ...prev }
                      for (const r of rows) if (actionable(r)) next[r.key] = { ...next[r.key], include: false }
                      return next
                    })
                  }
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
                >
                  Select none
                </button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selected.length || !!applying}
                  onClick={() => runApply(selected, `Apply ${selected.length} change${selected.length === 1 ? '' : 's'}`)}
                  className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                >
                  {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Apply selected to the app
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------

const sceneLabel = (r: CompareRow) =>
  r.left && r.right && r.renumbered ? `${r.left.number} → ${r.right.number}` : (r.right?.number ?? r.left!.number)

function SummaryChip({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'emerald' | 'red' | 'sky' }) {
  const tones = {
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    red: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300',
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300',
  }
  return (
    <span className={`rounded-md border px-2 py-0.5 font-mono ${value ? tones[tone] : 'border-border text-muted-foreground'}`}>
      {value} {label}
    </span>
  )
}

function KindDot({ row }: { row: CompareRow }) {
  const color =
    row.kind === 'CHANGED'
      ? 'bg-amber-500'
      : row.kind === 'NEW'
        ? 'bg-emerald-500'
        : row.kind === 'OMITTED'
          ? 'bg-red-500'
          : row.renumbered
            ? 'bg-sky-500'
            : 'bg-muted-strong'
  return <span className={`size-2 shrink-0 rounded-full ${color}`} />
}

const KIND_LABEL: Record<CompareRow['kind'], string> = {
  CHANGED: 'Changed',
  NEW: 'New scene',
  OMITTED: 'Omitted',
  UNCHANGED: 'Unchanged',
}

const STATE_BADGE: Record<AppState, { label: string; className: string }> = {
  APPLIED: { label: 'In the app', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  PENDING: { label: 'Not applied', className: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300' },
  EDITED: { label: 'Edited in the app', className: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400' },
  TAKEN: { label: 'Number in use', className: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400' },
}

function Parts({ parts }: { parts: DiffPart[] }) {
  return (
    <>
      {parts.map(([op, text], i) =>
        op === 0 ? (
          <span key={i}>{text}</span>
        ) : op === -1 ? (
          <del key={i} className="bg-red-100 text-red-700 decoration-red-500/70">
            {text}
          </del>
        ) : (
          <ins key={i} className="no-underline bg-yellow-200 text-[#111]">
            {text}
          </ins>
        )
      )}
    </>
  )
}

interface CompareRowViewProps {
  row: CompareRow
  status: RowStatus | undefined
  decision: { include: boolean; addCast: string[]; removeCast: string[] }
  actionable: boolean
  active: boolean
  busy: boolean
  projectId: string
  unpairedLeft: string[]
  oldVersion: number | undefined
  refCallback: (el: HTMLElement | null) => void
  onEdit: (patch: RowEdit) => void
  onUnpair: () => void
  onPair: (leftNumber: string) => void
  onApply: () => void
}

function CompareRowView({
  row: r,
  status,
  decision,
  actionable,
  active,
  busy,
  projectId,
  unpairedLeft,
  oldVersion,
  refCallback,
  onEdit,
  onUnpair,
  onPair,
  onApply,
}: CompareRowViewProps) {
  const change = r.kind !== 'UNCHANGED' || r.renumbered
  const scene = status?.scene ?? null
  const sceneCast = new Set(scene?.cast ?? [])
  const toggle = (list: string[], name: string) => (list.includes(name) ? list.filter((n) => n !== name) : [...list, name])
  const removable = r.charactersRemoved.filter((c) => sceneCast.has(c))
  const addable = r.charactersAdded.filter((c) => !sceneCast.has(c))
  const oneLinerStale = !!scene?.synopsis && r.kind === 'CHANGED' && status?.state !== 'APPLIED'

  return (
    <section
      ref={refCallback}
      className={`scroll-mt-2 rounded-xl border bg-card ${active ? 'border-amber-500 ring-1 ring-amber-500/30' : change ? 'border-border-strong' : 'border-border/70'}`}
    >
      {/* Row header */}
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2 text-[11px] ${change ? 'border-b border-border' : ''}`}>
        {actionable && (
          <input
            type="checkbox"
            checked={decision.include}
            disabled={busy}
            onChange={(e) => onEdit({ include: e.target.checked })}
            className="accent-amber-500 cursor-pointer"
            aria-label={`Include scene ${sceneLabel(r)} when applying`}
          />
        )}
        <span className="font-mono font-bold text-amber-700 dark:text-amber-400">SC {sceneLabel(r)}</span>
        {change && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <KindDot row={r} /> {r.kind === 'UNCHANGED' ? 'Renumbered' : KIND_LABEL[r.kind]}
            {r.renumbered && r.kind !== 'UNCHANGED' && ' · renumbered'}
          </span>
        )}
        {(r.wordsAdded > 0 || r.wordsRemoved > 0) && (
          <span className="font-mono">
            <span className="text-emerald-700 dark:text-emerald-400">+{r.wordsAdded}</span>{' '}
            <span className="text-red-700 dark:text-red-400">−{r.wordsRemoved}</span>
            <span className="text-muted-foreground"> words</span>
          </span>
        )}
        {r.headingChanged && <span className="text-muted-foreground">· heading changed</span>}
        {r.left && r.right && signedEighths(r.eighthsDelta) && <span className="font-mono text-muted-foreground">· {signedEighths(r.eighthsDelta)}</span>}
        {r.pairedBy === 'SIMILARITY' && <span className="text-sky-700 dark:text-sky-400">· matched by text</span>}
        {r.pairedBy === 'USER' && <span className="text-sky-700 dark:text-sky-400">· matched by you</span>}
        {r.doubtfulPair && (
          <span className="flex items-center gap-1 text-red-700 dark:text-red-400">
            <AlertTriangle className="size-3" /> text is very different — maybe not the same scene
          </span>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {scene?.days.map((d, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 font-mono text-muted-foreground"
              title={d.callSheet ? `Call sheet: ${d.callSheet.toLowerCase()}` : 'No call sheet yet'}
            >
              <CalendarDays className="size-3" />
              Day {d.dayNumber ?? '?'}
              {(d.callSheet === 'PUBLISHED' || d.callSheet === 'REVISED') && change && (
                <span className="text-red-700 dark:text-red-400">· call sheet sent</span>
              )}
            </span>
          ))}
          {change && status && (
            <span className={`rounded border px-1.5 py-0.5 font-mono ${STATE_BADGE[status.state].className}`}>
              {r.kind === 'OMITTED' && status.state === 'PENDING'
                ? 'Still in the app'
                : r.kind === 'OMITTED' && status.state === 'APPLIED'
                  ? 'Removed from the app'
                  : STATE_BADGE[status.state].label}
            </span>
          )}
          {actionable && (
            <button
              type="button"
              disabled={busy}
              onClick={onApply}
              className="rounded-md border border-amber-500/50 px-2 py-0.5 font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer disabled:opacity-50"
            >
              {r.kind === 'OMITTED' ? 'Delete from app' : 'Apply'}
            </button>
          )}
        </div>
      </div>

      {/* What the system decided — every part can be changed */}
      {change && (
        <div className="flex flex-col gap-1.5 px-3 py-2 text-[11px] text-muted-foreground border-b border-border empty:hidden">
          {r.left && r.right && (
            <div className="flex items-center gap-2">
              <Link2 className="size-3 shrink-0" />
              <span>
                Old {r.left.number} and new {r.right.number} are treated as the same scene
                {scene ? ' — its breakdown and schedule carry over' : ''}.
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={onUnpair}
                className="flex items-center gap-1 text-foreground hover:text-amber-700 dark:hover:text-amber-400 cursor-pointer disabled:opacity-50"
              >
                <Unlink className="size-3" /> Not the same scene
              </button>
            </div>
          )}
          {r.kind === 'NEW' && unpairedLeft.length > 0 && (
            <label className="flex items-center gap-2">
              <Link2 className="size-3 shrink-0" />
              <span>Is this an old scene renumbered?</span>
              <select
                value=""
                disabled={busy}
                onChange={(e) => e.target.value && onPair(e.target.value)}
                className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-foreground cursor-pointer"
              >
                <option value="">No, a new scene</option>
                {unpairedLeft.map((n) => (
                  <option key={n} value={n}>
                    Same as old scene {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {r.kind === 'OMITTED' && status?.state === 'PENDING' && (
            <span>
              Not in the new draft. It stays in the app (with its breakdown{scene?.days.length ? ' and on the schedule' : ''}) unless you
              delete it.
            </span>
          )}
          {status?.state === 'TAKEN' && (
            <span className="text-red-700 dark:text-red-400">
              Scene number {r.right!.number} is held by another scene in the app that stays. Renumber that scene in the Script
              Reader first{r.kind === 'NEW' ? ', or pair this scene with an old one' : ''}.
            </span>
          )}
          {status?.state === 'EDITED' && (
            <span className="text-red-700 dark:text-red-400">
              This scene was edited in the app after {oldVersion ? `v${oldVersion}` : 'the old draft'}. Applying replaces those edits
              with the new draft&apos;s text.
            </span>
          )}
          {actionable && (addable.length > 0 || removable.length > 0) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Breakdown:</span>
              {addable.map((c) => (
                <label key={`a-${c}`} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={decision.addCast.includes(c)}
                    onChange={() => onEdit({ addCast: toggle(decision.addCast, c) })}
                    className="accent-emerald-500"
                  />
                  <span className="text-emerald-700 dark:text-emerald-400">add {c}</span>
                </label>
              ))}
              {removable.map((c) => (
                <label key={`r-${c}`} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={decision.removeCast.includes(c)}
                    onChange={() => onEdit({ removeCast: toggle(decision.removeCast, c) })}
                    className="accent-red-500"
                  />
                  <span className="text-red-700 dark:text-red-400">remove {c} (no longer speaks)</span>
                </label>
              ))}
            </div>
          )}
          {oneLinerStale && (
            <span>
              One-liner may be out of date: &ldquo;{scene!.synopsis}&rdquo; —{' '}
              <Link href={`/projects/${projectId}/breakdown?scene=${scene!.id}`} className="text-foreground underline hover:text-amber-700">
                edit in Breakdown
              </Link>
            </span>
          )}
        </div>
      )}

      {/* Side by side text */}
      <div className="grid md:grid-cols-2 md:divide-x divide-border">
        <SceneText heading={r.headingLeftParts} body={r.leftParts} empty={!r.left} emptyLabel="Not in this draft" />
        <SceneText heading={r.headingRightParts} body={r.rightParts} empty={!r.right} emptyLabel="OMITTED" />
      </div>
    </section>
  )
}

/** One side of a scene, laid out like a screenplay page, with its changes marked inside the lines */
function SceneText({ heading, body, empty, emptyLabel }: { heading: DiffPart[]; body: DiffPart[]; empty: boolean; emptyLabel: string }) {
  const lines = useMemo(() => {
    const tracked = diffLines(body)
    const types = classifyScreenplayLines(tracked.map((l) => l.text).join('\n'), [])
    return tracked.map((l, i) => ({ ...l, type: types[i]?.type ?? 'ACTION' }))
  }, [body])

  if (empty) {
    return (
      <div className="flex items-center justify-center p-6 text-[11px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/30">
        {emptyLabel}
      </div>
    )
  }
  // Screenplay paper is intentionally fixed white/black, like the reader
  return (
    <div
      className="min-w-0 bg-white text-[#111] px-5 py-4 text-[12px] leading-[1.55]"
      style={{ fontFamily: "'Courier Prime', 'Courier New', Courier, monospace" }}
    >
      <div className="mb-2 font-bold uppercase">
        <Parts parts={heading} />
      </div>
      {lines.map((l, i) => {
        const content = <Parts parts={l.parts} />
        if (l.type === 'EMPTY') return l.parts.length ? <div key={i}>{content}</div> : <div key={i} className="h-[1.1em]" />
        if (l.type === 'CHARACTER')
          return (
            <div key={i} className="mt-3 font-bold uppercase" style={{ paddingLeft: '37%' }}>
              {content}
            </div>
          )
        if (l.type === 'PARENTHETICAL')
          return (
            <div key={i} className="italic text-zinc-700" style={{ paddingLeft: '30%' }}>
              {content}
            </div>
          )
        if (l.type === 'DIALOGUE')
          return (
            <div key={i} style={{ paddingLeft: '20%', paddingRight: '12%' }}>
              {content}
            </div>
          )
        if (l.type === 'TRANSITION')
          return (
            <div key={i} className="mt-2 text-right font-bold uppercase">
              {content}
            </div>
          )
        if (l.type === 'SLUGLINE')
          return (
            <div key={i} className="mt-3 font-bold uppercase">
              {content}
            </div>
          )
        return <div key={i}>{content}</div>
      })}
    </div>
  )
}
