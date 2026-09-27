'use client'

import React, { useState } from 'react'
import { Lock, Unlock, AlertTriangle, ShieldAlert, CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LiveLockBannerProps {
  resourceName?: string
  lockedBy?: string
  lockedAt?: string
  onOverrideLock?: () => void
}

export function LiveLockBanner({
  resourceName = 'Stripboard Day 4',
  lockedBy = 'Sarah Lin (Line Producer)',
  lockedAt = '2 mins ago',
  onOverrideLock,
}: LiveLockBannerProps) {
  const [isLocked, setIsLocked] = useState(true)
  const [overrideSuccess, setOverrideSuccess] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const handleRelease = () => {
    setIsLocked(false)
  }

  const handleOverride = () => {
    setOverrideSuccess(true)
    setIsLocked(false)
    if (onOverrideLock) onOverrideLock()
  }

  if (!isLocked) {
    if (overrideSuccess && !isDismissed) {
      return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs my-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            <span>Lock override granted. You now have exclusive edit access to <strong>{resourceName}</strong>.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss message"
            title="Dismiss"
            className="p-1 rounded-md hover:bg-emerald-500/15 transition-colors cursor-pointer shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-background to-background border border-amber-500/30 text-amber-200 text-xs my-3 gap-3 shadow-lg">
      <div className="flex items-start gap-2.5">
        <div className="size-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400 shrink-0">
          <Lock className="size-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-sm">{resourceName} is currently locked</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-[10px]">
              Live Edit Lock
            </span>
          </div>
          <p className="text-muted-foreground text-xs mt-0.5">
            <strong>{lockedBy}</strong> is actively making changes ({lockedAt}). Concurrent saves are paused to prevent conflicts.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={handleOverride}
          className="border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:text-foreground text-xs h-8 cursor-pointer"
        >
          <ShieldAlert className="size-3.5 mr-1.5" />
          Request Override
        </Button>
      </div>
    </div>
  )
}
