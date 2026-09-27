'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ShieldAlert,
  Trash2,
  Lock,
  RotateCcw,
  Loader2,
  X
} from 'lucide-react'

export interface DeleteConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: string
  description?: string
  itemName: string
  itemType?: string // e.g. "production", "resource", "item"
  isPending?: boolean
  /** Extra content under the description (e.g. an impact summary or options) */
  children?: React.ReactNode
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  itemName,
  itemType = 'item',
  isPending = false,
  children,
}: DeleteConfirmModalProps) {
  const [typedName, setTypedName] = useState('')
  const [clickCount, setClickCount] = useState(0)

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setTypedName('')
      setClickCount(0)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPending) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isPending, onClose])

  if (!isOpen) return null

  const isNameMatched =
    Boolean(itemName) &&
    typedName.trim().toLowerCase() === itemName.trim().toLowerCase()

  const handleDeleteClick = () => {
    if (!isNameMatched || isPending) return

    if (clickCount < 2) {
      setClickCount((prev) => prev + 1)
    } else {
      // 3rd click: execute confirmation
      onConfirm()
    }
  }

  const handleClose = () => {
    if (isPending) return
    setTypedName('')
    setClickCount(0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-xl border border-red-900/50 bg-background p-6 shadow-2xl shadow-red-950/40 ring-1 ring-red-900/40 space-y-6 relative"
        role="dialog"
        aria-modal="true"
      >
        {/* Close X */}
        <button
          type="button"
          disabled={isPending}
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-card disabled:opacity-50 cursor-pointer"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pr-6">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-xs font-mono uppercase font-semibold">
            <ShieldAlert className="size-4" /> Accidental Deletion Protection
          </div>
          <h3 className="text-lg font-bold text-foreground tracking-tight">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
          {children}
        </div>

        {/* Warning & Name Confirmation Box */}
        <div className="rounded-lg bg-red-950/20 border border-red-900/40 p-4 space-y-3">
          <p className="text-xs text-subtle-foreground leading-relaxed">
            To prevent accidental deletion, please type the exact {itemType} name{' '}
            <span className="font-mono font-semibold text-foreground bg-card px-2 py-0.5 rounded border border-border-strong select-all">
              {itemName}
            </span>{' '}
            below, then complete a 3-click confirmation.
          </p>

          <div className="space-y-1.5">
            <Label
              htmlFor="modalConfirmDeleteName"
              className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground"
            >
              Type {itemType} name to unlock
            </Label>
            <Input
              id="modalConfirmDeleteName"
              autoFocus
              value={typedName}
              onChange={(e) => {
                setTypedName(e.target.value)
                setClickCount(0)
              }}
              placeholder={`Type "${itemName}" to unlock`}
              disabled={isPending}
              className="bg-background border-border focus-visible:ring-red-500 text-foreground font-mono text-xs h-10"
            />
          </div>
        </div>

        {/* Security Gates & Click Tracker */}
        <div className="flex items-center justify-between text-xs py-1 px-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">Security Gate:</span>
            <span
              className={`text-[11px] px-2.5 py-0.5 rounded font-mono font-medium ${
                isNameMatched
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-card text-faint border border-border'
              }`}
            >
              1. Name Match {isNameMatched ? '✓ UNLOCKED' : '— LOCKED'}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-faint text-[11px]">2. Confirm Clicks ({clickCount}/3):</span>
            {[1, 2, 3].map((step) => (
              <span
                key={step}
                className={`size-6 rounded flex items-center justify-center font-bold text-[11px] transition-all ${
                  clickCount >= step
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/40 ring-2 ring-red-400'
                    : isNameMatched
                    ? 'bg-muted text-subtle-foreground border border-border-strong'
                    : 'bg-card text-faint border border-border/80'
                }`}
              >
                {step}
              </span>
            ))}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="border-t border-border/80 pt-4 flex items-center justify-between gap-3">
          {clickCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setClickCount(0)}
              className="border-border text-muted-foreground hover:text-foreground text-xs h-9 cursor-pointer"
            >
              <RotateCcw className="size-3.5 mr-1.5" /> Reset Clicks
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleClose}
              className="border-border text-muted-foreground hover:text-foreground text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>
          )}

          <div className="ml-auto">
            {!isNameMatched ? (
              <Button
                type="button"
                disabled
                className="bg-card text-faint border border-border text-xs h-9 cursor-not-allowed"
              >
                <Lock className="size-3.5 mr-1.5" /> Type Name to Unlock
              </Button>
            ) : (
              <Button
                type="button"
                disabled={isPending}
                onClick={handleDeleteClick}
                className={`text-xs h-9 font-semibold transition-all cursor-pointer ${
                  clickCount === 0
                    ? 'bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/80 shadow-md'
                    : clickCount === 1
                    ? 'bg-red-700 hover:bg-red-600 text-white shadow-lg shadow-red-700/30 ring-2 ring-red-400'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/50 ring-4 ring-red-400 animate-pulse'
                }`}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Executing Deletion...
                  </>
                ) : clickCount === 0 ? (
                  <>
                    <Trash2 className="size-3.5 mr-1.5" />
                    Click 1 of 3: Confirm Deletion
                  </>
                ) : clickCount === 1 ? (
                  <>
                    <ShieldAlert className="size-3.5 mr-1.5" />
                    Click 2 of 3: Are You Sure?
                  </>
                ) : (
                  <>
                    <Trash2 className="size-3.5 mr-1.5" />
                    Click 3 of 3: DESTROY NOW
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
