'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Calendar, Clock, ExternalLink, FileText, Link2, MapPin, RefreshCw, Tag, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { getStripColorClasses } from '@/features/scheduling/lib/strip-colors'
import { formatClockTime } from '@/features/reports/lib/dood-status'
import { loadSceneDetail, formatPageEighths, type SceneDetail } from '../lib/scene-detail'
import { parseShootAfterTag } from '@/features/scheduling/lib/availability-conflicts'

interface SceneDetailModalProps {
  sceneId: string | null
  onClose: () => void
}

const GROUPS: Array<{ label: string; types: string[] }> = [
  { label: 'Cast', types: ['CAST'] },
  { label: 'Background & Stunts', types: ['EXTRA', 'STUNT'] },
  { label: 'Locations', types: ['LOCATION'] },
  { label: 'Props & Set', types: ['PROP', 'VEHICLE', 'ANIMAL', 'EQUIPMENT'] },
  { label: 'Wardrobe & Makeup', types: ['WARDROBE', 'MAKEUP'] },
  { label: 'Effects & Sound', types: ['VFX', 'SFX', 'SOUND', 'MUSIC'] },
  { label: 'Other', types: ['OTHER'] },
]

/** Detail popup for one scene: schedule placement, breakdown, and the scene's script text. */
export function SceneDetailModal({ sceneId, onClose }: SceneDetailModalProps) {
  const isOpen = sceneId !== null
  const closeRef = useModalBehavior(isOpen, onClose)
  const [loaded, setLoaded] = useState<{ id: string; detail: SceneDetail | null } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!sceneId) return
    let cancelled = false
    loadSceneDetail(createClient(), sceneId).then((detail) => {
      if (!cancelled) setLoaded({ id: sceneId, detail })
    })
    return () => {
      cancelled = true
    }
  }, [sceneId, reloadKey])

  if (!isOpen || typeof document === 'undefined') return null
  const isLoading = loaded?.id !== sceneId
  const detail = isLoading ? null : loaded?.detail ?? null
  const scene = detail?.scene
  const projectId = scene?.project_id

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scene-detail-title"
        className="relative w-full max-w-4xl max-h-[92vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border bg-card/60">
          <div className="min-w-0 space-y-1.5">
            {scene ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-md border font-mono font-black text-sm ${
                      getStripColorClasses(scene.int_ext, scene.time_of_day).container
                    }`}
                  >
                    SC {scene.scene_number}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-muted text-xs font-mono text-subtle-foreground">
                    {(scene.int_ext || 'INT').replace('_', '/')} · {scene.time_of_day || 'DAY'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-muted text-xs text-subtle-foreground">{scene.status}</span>
                  {scene.is_changed && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs">
                      Changed in latest draft
                    </span>
                  )}
                </div>
                <h2 id="scene-detail-title" className="text-base sm:text-lg font-bold font-mono uppercase tracking-wide text-foreground">
                  {scene.heading || 'Untitled scene'}
                </h2>
              </>
            ) : (
              <h2 id="scene-detail-title" className="text-base font-semibold text-foreground">
                {isLoading ? 'Loading scene…' : 'Scene not found'}
              </h2>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close scene details (Esc)"
            title="Close (Esc)"
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" /> Loading…
          </div>
        ) : !detail || !scene ? (
          <div className="py-24 text-center text-sm text-muted-foreground">This scene may have been deleted.</div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-5 gap-0">
            {/* Facts & breakdown */}
            <aside className="lg:col-span-2 p-5 space-y-5 border-b lg:border-b-0 lg:border-r border-border">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Fact icon={MapPin} label="Location" value={scene.location_name || '—'} wide />
                <Fact icon={FileText} label="Length" value={`${formatPageEighths(scene.page_start, scene.page_end)} pg`} />
                <Fact icon={FileText} label="Pages" value={`${scene.page_start ?? '—'}${scene.page_end && scene.page_end !== scene.page_start ? `–${scene.page_end}` : ''}`} />
                <Fact icon={Clock} label="Est. shoot time" value={scene.estimated_duration ? `${scene.estimated_duration} min` : '—'} />
                <Fact
                  icon={Calendar}
                  label="Scheduled"
                  value={
                    detail.schedule
                      ? `Day ${detail.schedule.dayNumber ?? '?'} · ${new Date(`${detail.schedule.shootDate}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}${detail.schedule.callTime ? ` · call ${formatClockTime(detail.schedule.callTime)}` : ''}`
                      : 'Not scheduled'
                  }
                  wide
                />
              </dl>

              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="size-3.5" /> Breakdown
                </h3>
                {detail.elements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing tagged yet.</p>
                ) : (
                  GROUPS.map((g) => {
                    const items = detail.elements.filter((e) => g.types.includes(e.type))
                    if (items.length === 0) return null
                    return (
                      <div key={g.label} className="space-y-1">
                        <div className="text-[11px] font-medium text-faint">{g.label}</div>
                        <ul className="space-y-1">
                          {items.map((e) => (
                            <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                              <span className={`truncate ${e.confirmed ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                                {e.name}
                                {e.resource?.type === 'PERSON' && e.resource.name !== 'TBC' && (
                                  <span className="text-muted-foreground not-italic"> — {e.resource.name}</span>
                                )}
                                {e.type === 'CAST' && e.confirmed && !e.resource && (
                                  <span className="text-[11px] text-amber-700 dark:text-amber-400 not-italic"> · not cast yet</span>
                                )}
                                {!e.confirmed && <span className="text-[11px]"> (unconfirmed)</span>}
                              </span>
                              {e.resource && projectId && (
                                <Link
                                  href={`/projects/${projectId}/resources/${e.resource.id}`}
                                  className="shrink-0 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400"
                                  title="Open in Cast & Crew"
                                >
                                  <Link2 className="size-3.5" />
                                </Link>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })
                )}
              </section>

              <ContinuityRules
                sceneId={scene.id}
                projectId={scene.project_id}
                tags={detail.tags}
                onChanged={() => setReloadKey((k) => k + 1)}
              />

              {detail.tags.filter((t) => parseShootAfterTag(t.label).length === 0).length > 0 && (
                <section className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="size-3.5" /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.tags
                      .filter((t) => parseShootAfterTag(t.label).length === 0)
                      .map((t) => (
                        <span key={t.id} className="px-2 py-0.5 rounded-full bg-muted text-xs text-subtle-foreground">
                          {t.label}
                        </span>
                      ))}
                  </div>
                </section>
              )}

              {detail.notes.length > 0 && (
                <section className="space-y-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</h3>
                  <ul className="space-y-1.5">
                    {detail.notes.map((n) => (
                      <li key={n.id} className="text-sm text-subtle-foreground whitespace-pre-line">
                        {n.note}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {projectId && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/projects/${projectId}/breakdown?scene=${scene.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
                  >
                    Edit breakdown <ExternalLink className="size-3.5" />
                  </Link>
                  {scene.script_document_id && (
                    <Link
                      href={`/projects/${projectId}/scripts/${scene.script_document_id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
                    >
                      Open script <ExternalLink className="size-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </aside>

            {/* Script text */}
            <section className="lg:col-span-3 p-4 sm:p-5 bg-muted/40">
              <div className="text-[11px] text-muted-foreground mb-2">{detail.scriptName || 'Script'}</div>
              <div
                className="screenplay-canvas bg-white text-[#111] rounded-lg shadow-sm px-6 sm:px-10 py-8 text-[13px] leading-relaxed"
                style={{ fontFamily: "'Courier Prime', 'Courier New', Courier, monospace" }}
              >
                <ScreenplayText text={scene.description} heading={scene.heading} />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

function Fact({
  icon: Icon,
  label,
  value,
  wide,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-[11px] text-faint flex items-center gap-1">
        <Icon className="size-3" /> {label}
      </dt>
      <dd className="text-foreground font-medium break-words">{value}</dd>
    </div>
  )
}

/**
 * Light screenplay layout for stored scene text: slugline bold, character cues centred,
 * parentheticals and dialogue indented (dialogue in dark blue, per the studio style).
 */
function ScreenplayText({ text, heading }: { text: string | null; heading: string | null }) {
  const lines = (text || '').replace(/\r/g, '').split('\n')
  if (!text?.trim()) {
    return <p className="text-zinc-500 italic">No script text stored for this scene.</p>
  }

  const isSlug = (l: string) => /^(INT|EXT|INT\.?\/EXT|I\/E)[\s.]/i.test(l.trim())
  const isCue = (l: string) => {
    const t = l.trim()
    return t.length > 0 && t.length < 40 && t === t.toUpperCase() && /[A-Z]/.test(t) && !isSlug(t) && !/[.!?]$/.test(t.replace(/\(.*\)$/, '').trim())
  }

  let inDialogue = false
  const out: React.ReactNode[] = []
  lines.forEach((raw, i) => {
    const t = raw.trim()
    if (!t) {
      inDialogue = false
      out.push(<div key={i} className="h-3" />)
      return
    }
    if (isSlug(t)) {
      inDialogue = false
      if (heading && t.toUpperCase() === heading.toUpperCase() && i < 3) {
        out.push(<p key={i} className="font-bold uppercase mb-2">{t}</p>)
      } else out.push(<p key={i} className="font-bold uppercase mt-2">{t}</p>)
      return
    }
    if (isCue(t)) {
      inDialogue = true
      out.push(<p key={i} className="mt-2 text-center uppercase">{t}</p>)
      return
    }
    if (inDialogue && /^\(.*\)$/.test(t)) {
      out.push(<p key={i} className="mx-auto max-w-[60%] text-center text-zinc-600">{t}</p>)
      return
    }
    if (inDialogue) {
      out.push(<p key={i} className="mx-auto max-w-[70%] text-blue-800">{t}</p>)
      return
    }
    out.push(<p key={i}>{t}</p>)
  })
  return <div>{out}</div>
}

/** "Shoot after scene …" continuity rules, stored as scene tags ("SHOOT AFTER 23"). */
function ContinuityRules({
  sceneId,
  projectId,
  tags,
  onChanged,
}: {
  sceneId: string
  projectId: string
  tags: Array<{ id: string; label: string }>
  onChanged: () => void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const rules = tags.filter((t) => parseShootAfterTag(t.label).length > 0)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = value.replace(/^\s*(?:sc(?:ene)?\.?\s*|#)/i, '').trim().toUpperCase()
    if (!num) return
    setBusy(true)
    await createClient()
      .from('scene_tags')
      .insert({ project_id: projectId, scene_id: sceneId, tag_type: 'CUSTOM', label: `SHOOT AFTER ${num}` })
    setBusy(false)
    setValue('')
    onChanged()
  }
  const remove = async (id: string) => {
    setBusy(true)
    await createClient().from('scene_tags').delete().eq('id', id)
    setBusy(false)
    onChanged()
  }

  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Link2 className="size-3.5" /> Continuity
      </h3>
      {rules.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rules.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-foreground">
              Shoot after Sc {parseShootAfterTag(r.label).join(', ')}
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={busy}
                aria-label={`Remove rule ${r.label}`}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={add} className="flex items-center gap-1.5">
        <label htmlFor={`after-${sceneId}`} className="text-xs text-muted-foreground shrink-0">
          Shoot after scene
        </label>
        <input
          id={`after-${sceneId}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 23"
          className="w-20 h-7 px-2 rounded-md border border-border bg-background text-sm"
        />
        <button
          type="submit"
          disabled={busy || !value.trim()}
          className="h-7 px-2 rounded-md border border-border text-xs hover:bg-muted disabled:opacity-50 cursor-pointer"
        >
          Add
        </button>
      </form>
      <p className="text-[11px] text-faint">The schedule warns if it&apos;s shot earlier, and suggestions never break it.</p>
    </section>
  )
}
