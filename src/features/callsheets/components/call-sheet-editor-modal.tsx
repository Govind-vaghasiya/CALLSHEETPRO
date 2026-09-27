'use client'

import React, { useState } from 'react'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import type { CallSheetDetails, CallSheetFullData } from '../actions'
import { saveCallSheetDetailsAction, updateCallSheetNotesAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText, Clock, X, Save, Sun, Cross, Utensils } from 'lucide-react'

interface CallSheetEditorModalProps {
  isOpen: boolean
  onClose: () => void
  data: CallSheetFullData
  onRefresh: () => void
}

const labelClass = 'text-[11px] text-muted-foreground font-bold uppercase flex items-center gap-1'
const inputClass = 'bg-card border-border text-foreground font-mono text-xs'

export function CallSheetEditorModal({ isOpen, onClose, data, onRefresh }: CallSheetEditorModalProps) {
  useModalBehavior(isOpen, onClose)
  const { currentDay, project } = data

  const [callTime, setCallTime] = useState(currentDay.call_time?.slice(0, 5) || '')
  const [wrapTime, setWrapTime] = useState(currentDay.wrap_time?.slice(0, 5) || '')
  const [notes, setNotes] = useState(currentDay.notes || '')
  const [details, setDetails] = useState<CallSheetDetails>(data.details)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const setWeather = (key: keyof CallSheetDetails['weather'], value: string) =>
    setDetails((d) => ({ ...d, weather: { ...d.weather, [key]: value } }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    const [dayRes, sheetRes] = await Promise.all([
      updateCallSheetNotesAction(currentDay.id, {
        callTime: callTime || undefined,
        wrapTime: wrapTime || undefined,
        notes,
      }),
      saveCallSheetDetailsAction(project.id, currentDay.id, details),
    ])
    setIsSaving(false)
    if (!dayRes.success || !sheetRes.success) {
      setError(dayRes.error || sheetRes.error || 'Could not save')
      return
    }
    onRefresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-border flex items-center justify-between bg-card/60">
          <div className="flex items-center gap-2 font-mono font-bold text-foreground text-sm">
            <FileText className="size-4 text-amber-700 dark:text-amber-400" />
            <span>Edit Call Sheet — Day {currentDay.day_number || 1}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 space-y-5 font-mono text-xs overflow-y-auto">
          {/* Times */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>
                <Clock className="size-3 text-amber-600 dark:text-amber-500" /> Crew call
              </label>
              <Input type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>
                <Clock className="size-3" /> Est. wrap
              </label>
              <Input type="time" value={wrapTime} onChange={(e) => setWrapTime(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>
                <Utensils className="size-3" /> Breakfast
              </label>
              <Input
                type="time"
                value={details.breakfast}
                onChange={(e) => setDetails((d) => ({ ...d, breakfast: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClass}>
                <Utensils className="size-3" /> Lunch
              </label>
              <Input
                type="time"
                value={details.lunch}
                onChange={(e) => setDetails((d) => ({ ...d, lunch: e.target.value }))}
                className={inputClass}
              />
            </div>
          </section>

          {/* Weather */}
          <section className="space-y-2">
            <div className={labelClass}>
              <Sun className="size-3 text-amber-600 dark:text-amber-500" /> Weather & sun
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Input placeholder="Temp (e.g. 24°C)" value={details.weather.temp} onChange={(e) => setWeather('temp', e.target.value)} className={inputClass} />
              <Input placeholder="Conditions" value={details.weather.condition} onChange={(e) => setWeather('condition', e.target.value)} className={inputClass} />
              <Input placeholder="Sunrise" value={details.weather.sunrise} onChange={(e) => setWeather('sunrise', e.target.value)} className={inputClass} />
              <Input placeholder="Sunset" value={details.weather.sunset} onChange={(e) => setWeather('sunset', e.target.value)} className={inputClass} />
            </div>
          </section>

          {/* Safety */}
          <section className="space-y-2">
            <div className={labelClass}>
              <Cross className="size-3 text-rose-600" /> Nearest hospital
            </div>
            <p className="text-[11px] text-muted-foreground">
              Defaults to the hospital saved on today&apos;s location in Cast &amp; Crew. Fill in here only to override it for this day.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="Hospital name"
                value={details.hospitalName}
                onChange={(e) => setDetails((d) => ({ ...d, hospitalName: e.target.value }))}
                className={`${inputClass} col-span-2`}
              />
              <Input
                type="number"
                step="0.1"
                placeholder="Distance (km)"
                value={details.hospitalKm ?? ''}
                onChange={(e) =>
                  setDetails((d) => ({ ...d, hospitalKm: e.target.value === '' ? null : Number(e.target.value) }))
                }
                className={inputClass}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Unit / company name</label>
              <Input
                value={details.unitName}
                onChange={(e) => setDetails((d) => ({ ...d, unitName: e.target.value }))}
                placeholder="e.g. Second Unit"
                className={inputClass}
              />
            </div>
          </section>

          <section className="space-y-1">
            <label className={labelClass}>Special instructions & safety</label>
            <textarea
              rows={3}
              value={details.specialInstructions}
              onChange={(e) => setDetails((d) => ({ ...d, specialInstructions: e.target.value }))}
              placeholder="e.g. Stunt rehearsal 08:00 on Stage 2. Hard hats required for exterior night setup."
              className="w-full bg-card border border-border rounded-xl p-3 text-foreground text-xs font-mono outline-none focus:border-amber-500 placeholder:text-faint"
            />
          </section>

          <section className="space-y-1">
            <label className={labelClass}>Producer / 1st AD announcements</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-card border border-border rounded-xl p-3 text-foreground text-xs font-mono outline-none focus:border-amber-500 placeholder:text-faint"
            />
          </section>

          {data.record.status === 'PUBLISHED' && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              This call sheet is published. Saving marks it as changed so you can publish a revision.
            </p>
          )}
          {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border text-muted-foreground hover:text-foreground text-xs font-mono h-8 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono h-8 cursor-pointer"
            >
              <Save className="size-3.5 mr-1" />
              {isSaving ? 'Saving…' : 'Save call sheet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
