'use client'

import React, { useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback-provider'
import { saveSceneOneLinerAction } from '../actions'
import { draftOneLinersAction } from '../ai-actions'

type Source = 'AI' | 'USER' | null

interface OneLinerEditorProps {
  sceneId: string
  projectId: string
  synopsis: string | null | undefined
  source: Source | undefined
  /** Saved or drafted (lets the caller keep its list in step without a reload) */
  onChange?: (sceneId: string, synopsis: string | null, source: Source) => void
  /** 1 = single-line input (wide layouts); more = wrapping text box (narrow panels) */
  rows?: number
}

/**
 * A scene's one-liner: edit in place (saved on Enter / leaving the field) or draft it with AI.
 * A person's edit marks it as theirs, so bulk AI drafting never overwrites it.
 * The hook lets a layout place the text field and the AI button separately (scene popup header).
 */
export function useOneLiner({ sceneId, projectId, synopsis, source, onChange }: Omit<OneLinerEditorProps, 'rows'>) {
  const { notify } = useFeedback()
  const [text, setText] = useState(synopsis || '')
  const [saved, setSaved] = useState(synopsis || '') // last saved text, to skip no-op saves
  const [currentSource, setCurrentSource] = useState<Source>(source ?? null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDrafting, setIsDrafting] = useState(false)

  // Another scene (or fresh data for this one) resets the editor
  const key = `${sceneId}|${synopsis ?? ''}|${source ?? ''}`
  const [loadedKey, setLoadedKey] = useState(key)
  if (key !== loadedKey) {
    setLoadedKey(key)
    setText(synopsis || '')
    setSaved(synopsis || '')
    setCurrentSource(source ?? null)
  }

  const save = async () => {
    const clean = text.replace(/\s+/g, ' ').trim()
    // Only a real edit saves (and marks an AI draft as the user's own)
    if (clean === saved.trim()) return
    setIsSaving(true)
    const res = await saveSceneOneLinerAction(sceneId, clean)
    setIsSaving(false)
    if (!res.success) {
      notify(res.error || 'Could not save the one-liner', 'error')
      return
    }
    const nextSource: Source = clean ? 'USER' : null
    setSaved(clean)
    setText(clean)
    setCurrentSource(nextSource)
    onChange?.(sceneId, clean || null, nextSource)
  }

  const draft = async () => {
    setIsDrafting(true)
    try {
      const res = await draftOneLinersAction(projectId, [sceneId], 'force')
      const drafted = res.drafted[0]
      if (drafted) {
        setSaved(drafted.synopsis)
        setText(drafted.synopsis)
        setCurrentSource('AI')
        onChange?.(sceneId, drafted.synopsis, 'AI')
      }
      if (res.error) notify(res.error, 'error')
      else if (!drafted) notify('The AI did not return a one-liner for this scene. Try again.', 'error')
    } catch {
      notify('Could not reach the server. Check your connection and try again.', 'error')
    } finally {
      setIsDrafting(false)
    }
  }

  const fieldProps = {
    id: `one-liner-${sceneId}`,
    value: text,
    maxLength: 200,
    placeholder: 'What happens in this scene, in one line — e.g. Sid checks himself out in the bathroom mirror',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setText(e.target.value),
    onBlur: save,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.currentTarget.blur()
      }
      if (e.key === 'Escape') {
        e.stopPropagation() // don't close a surrounding popup
        setText(saved)
        e.currentTarget.blur()
      }
    },
  }

  return { text, source: currentSource, isSaving, isDrafting, draft, fieldProps }
}

const FIELD_CLASS =
  'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-faint outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'

/** "✨ Draft with AI" / "Redraft with AI" for a scene's one-liner. */
export function OneLinerAiButton({ oneLiner, className = '' }: { oneLiner: ReturnType<typeof useOneLiner>; className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={oneLiner.draft}
      disabled={oneLiner.isDrafting}
      className={`h-7 text-xs font-mono text-violet-700 dark:text-violet-400 hover:bg-violet-500/10 cursor-pointer ${className}`}
      title={oneLiner.source === 'USER' ? 'Replace your one-liner with an AI draft' : 'Draft this one-liner with AI'}
    >
      <Sparkles className={`size-3.5 mr-1 ${oneLiner.isDrafting ? 'animate-pulse' : ''}`} />
      {oneLiner.isDrafting ? 'Drafting…' : oneLiner.text.trim() ? 'Redraft with AI' : 'Draft with AI'}
    </Button>
  )
}

/** Labelled one-liner field with its AI button (breakdown scene header). */
export function OneLinerEditor({ rows = 1, ...props }: OneLinerEditorProps) {
  const oneLiner = useOneLiner(props)
  const { sceneId } = props
  const { fieldProps } = oneLiner

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={`one-liner-${sceneId}`}
          className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
        >
          <FileText className="size-3 text-amber-600 dark:text-amber-500" />
          One-liner
          {oneLiner.source === 'AI' && (
            <span className="normal-case font-normal tracking-normal text-[10px] px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400">
              AI draft
            </span>
          )}
          {oneLiner.isSaving && <span className="normal-case font-normal text-faint">saving…</span>}
        </label>
        <OneLinerAiButton oneLiner={oneLiner} />
      </div>
      {rows > 1 ? (
        <textarea {...fieldProps} rows={rows} className={`${FIELD_CLASS} resize-none leading-snug`} />
      ) : (
        <input {...fieldProps} type="text" className={`${FIELD_CLASS} h-9`} />
      )}
    </div>
  )
}
