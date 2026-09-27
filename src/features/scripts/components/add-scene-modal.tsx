'use client'

import React, { useState } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import type { IntExt, TimeOfDay } from '@/types/database'
import { createSceneAction } from '@/features/scripts/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Plus,
  Clapperboard,
  MapPin,
  Clock,
  BookOpen,
  Sparkles,
} from 'lucide-react'

interface AddSceneModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  scriptId: string
  nextSuggestedNumber: string
  onSceneCreated?: (newScene: any) => void
}

export function AddSceneModal({
  isOpen,
  onClose,
  projectId,
  scriptId,
  nextSuggestedNumber,
  onSceneCreated,
}: AddSceneModalProps) {
  useModalBehavior(isOpen, onClose)
  const [sceneNumber, setSceneNumber] = useState(nextSuggestedNumber)
  const [intExt, setIntExt] = useState<IntExt>('INT')
  const [locationName, setLocationName] = useState('')
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('DAY')
  const [customHeading, setCustomHeading] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('1')
  const [pageStart, setPageStart] = useState('1')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const autoHeading = `${intExt}. ${locationName.trim().toUpperCase() || 'LOCATION'} - ${timeOfDay}`
  const finalHeading = customHeading.trim() ? customHeading.trim().toUpperCase() : autoHeading

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sceneNumber.trim()) {
      setError('Scene number is required')
      return
    }
    if (!locationName.trim() && !customHeading.trim()) {
      setError('Location or slugline heading is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const durSec = Math.max(15, Math.round((parseFloat(durationMinutes) || 1) * 60))
    const pNum = Math.max(1, parseInt(pageStart) || 1)

    const res = await createSceneAction({
      projectId,
      scriptId,
      sceneNumber: sceneNumber.trim().toUpperCase(),
      intExt,
      locationName: locationName.trim().toUpperCase() || 'UNSPECIFIED LOCATION',
      timeOfDay,
      heading: finalHeading,
      description: description.trim() || `${finalHeading}\n\n`,
      pageStart: pNum,
      pageEnd: pNum,
      estimatedDuration: durSec,
    })

    setIsSubmitting(false)

    if (res.error) {
      setError(res.error)
      return
    }

    if (res.scene && onSceneCreated) {
      onSceneCreated(res.scene)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-card/40">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Clapperboard className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Add New Scene</h2>
              <p className="text-xs text-muted-foreground">
                Insert a coverage shot, pickup, or montage scene
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Row 1: Scene Number & INT/EXT */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-subtle-foreground">
                Scene Number <span className="text-amber-600 dark:text-amber-500">*</span>
              </label>
              <Input
                value={sceneNumber}
                onChange={(e) => setSceneNumber(e.target.value)}
                placeholder="e.g. 158, 4B, 10A"
                className="bg-card border-border text-foreground font-mono font-bold text-sm"
                required
              />
              <span className="text-[10px] text-faint font-mono">
                Numbers or sub-scenes (e.g. 4B)
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-subtle-foreground">
                INT / EXT <span className="text-amber-600 dark:text-amber-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1 bg-card p-1 rounded-lg border border-border text-xs font-mono">
                {(['INT', 'EXT', 'INT_EXT'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setIntExt(mode)}
                    className={`py-1.5 rounded transition-all cursor-pointer text-center font-bold ${
                      intExt === mode
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {mode === 'INT_EXT' ? 'I/E' : mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Location / Set Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-subtle-foreground flex items-center gap-1.5">
              <MapPin className="size-3 text-amber-600 dark:text-amber-500" />
              <span>Location / Set Name</span>
              <span className="text-amber-600 dark:text-amber-500">*</span>
            </label>
            <Input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. BROWN HOUSE - DRIVEWAY, POLICE STATION"
              className="bg-card border-border text-foreground font-mono uppercase text-xs"
              required
            />
          </div>

          {/* Row 3: Time of Day Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-subtle-foreground flex items-center gap-1.5">
              <Clock className="size-3 text-amber-600 dark:text-amber-500" />
              <span>Time of Day</span>
            </label>
            <div className="grid grid-cols-5 gap-1 bg-card p-1 rounded-lg border border-border text-xs font-mono text-center">
              {(['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS'] as const).map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => setTimeOfDay(time)}
                  className={`py-1 rounded transition-all cursor-pointer font-semibold ${
                    timeOfDay === time
                      ? 'bg-muted text-amber-700 dark:text-amber-400 border border-border-strong'
                      : 'text-faint hover:text-subtle-foreground'
                  }`}
                >
                  {time === 'CONTINUOUS' ? 'CONT.' : time}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Slugline Preview */}
          <div className="p-3 rounded-lg bg-card/60 border border-border/80 space-y-1">
            <div className="text-[10px] font-mono uppercase text-faint">
              Slugline Preview
            </div>
            <div className="font-mono text-xs font-bold text-amber-700 dark:text-amber-400 tracking-wide">
              {finalHeading}
            </div>
          </div>

          {/* Row 4: Page Number & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-subtle-foreground flex items-center gap-1">
                <BookOpen className="size-3 text-muted-foreground" />
                <span>Page Reference</span>
              </label>
              <Input
                type="number"
                min="1"
                value={pageStart}
                onChange={(e) => setPageStart(e.target.value)}
                placeholder="1"
                className="bg-card border-border text-foreground font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-subtle-foreground flex items-center gap-1">
                <Clock className="size-3 text-muted-foreground" />
                <span>Est. Shoot Time (min)</span>
              </label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                placeholder="1"
                className="bg-card border-border text-foreground font-mono text-xs"
              />
            </div>
          </div>

          {/* Row 5: Action / Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-subtle-foreground">
              Scene Description / Production Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief summary of the action, characters, or camera setups for this scene..."
              className="w-full p-2.5 rounded-lg bg-card border border-border text-xs font-mono text-foreground placeholder:text-faint outline-none focus:border-amber-500/80 resize-none leading-relaxed"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
            >
              <Plus className="size-4 mr-1" />
              <span>{isSubmitting ? 'Creating...' : 'Add Scene'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
