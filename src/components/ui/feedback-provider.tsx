'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type ToastKind = 'success' | 'error' | 'info'

interface FeedbackApi {
  /** In-app replacement for window.confirm — resolves true when confirmed. */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Small auto-dismissing message in the corner (replaces window.alert). */
  notify: (message: string, kind?: ToastKind) => void
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used inside <FeedbackProvider>')
  return ctx
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; kind: ToastKind }>>([])
  const nextId = useRef(0)

  const confirm = useCallback((options: ConfirmOptions) => {
    resolverRef.current?.(false)
    setPending(options)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = useCallback((ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setPending(null)
  }, [])

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 4000)
  }, [])

  return (
    <FeedbackContext.Provider value={{ confirm, notify }}>
      {children}
      <ConfirmDialog options={pending} onSettle={settle} />
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className="flex items-start gap-2 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg px-3.5 py-3 text-sm animate-in fade-in slide-in-from-bottom-2"
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="size-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : t.kind === 'error' ? (
              <AlertTriangle className="size-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
            ) : (
              <Info className="size-4 mt-0.5 text-muted-foreground shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  )
}

function ConfirmDialog({ options, onSettle }: { options: ConfirmOptions | null; onSettle: (ok: boolean) => void }) {
  const cancelRef = useModalBehavior(options !== null, () => onSettle(false))
  if (!options) return null
  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onSettle(false)
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3">
          {options.destructive && (
            <div className="size-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
            </div>
          )}
          <div className="space-y-1">
            <h2 id="confirm-title" className="text-base font-semibold text-foreground">
              {options.title}
            </h2>
            {options.message && <p className="text-sm text-muted-foreground whitespace-pre-line">{options.message}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={() => onSettle(false)} className="cursor-pointer">
            {options.cancelLabel || 'Cancel'}
          </Button>
          <Button
            type="button"
            onClick={() => onSettle(true)}
            className={`cursor-pointer ${
              options.destructive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
            }`}
          >
            {options.confirmLabel || 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
