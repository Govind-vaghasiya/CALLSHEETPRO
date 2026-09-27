'use client'

import React, { useState, useEffect } from 'react'
import { useFeedback } from '@/components/ui/feedback-provider'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { AlertCircle, Trash2, Clock, X } from 'lucide-react'
import type { AvailabilityStatus } from '@/types/database'
import type { ResourceAvailabilityWindow, ResourceAvailabilityRow } from '../types'
import { saveAvailabilityWindowAction, deleteAvailabilityWindowAction } from '../actions'

interface AvailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  resources: ResourceAvailabilityRow[]
  dates: string[]
  editingWindow?: ResourceAvailabilityWindow | null
  initialResourceId?: string
  initialDate?: string
  /** Called after save/delete; receives the saved window (null after delete) */
  onSaved?: (saved: ImpactQuery | null) => void
  /** Preview the impact of the window as entered, without saving */
  onCheckImpact?: (query: ImpactQuery) => void
}

export interface ImpactQuery {
  resourceId: string
  startDate: string
  endDate: string
  startTime: string | null
  endTime: string | null
  status: AvailabilityStatus
}

const STATUS_OPTIONS: Array<{ value: AvailabilityStatus; label: string; color: string; desc: string }> = [
  { value: 'AVAILABLE', label: 'Available', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', desc: 'Fully available for calls' },
  { value: 'UNAVAILABLE', label: 'Unavailable / Blackout', color: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30', desc: 'Hard blackout — cannot be scheduled' },
  { value: 'HOLD', label: 'On Hold', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30', desc: 'Tentative hold pending confirmation' },
  { value: 'TRAVEL', label: 'Travel Day', color: 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30', desc: 'In transit to/from location' },
  { value: 'PARTIAL', label: 'Partial Availability', color: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30', desc: 'Unavailable for the hours you set (use Specific hours)' },
]

export function AvailabilityModal({
  isOpen,
  onClose,
  projectId,
  resources,
  dates,
  editingWindow,
  initialResourceId,
  initialDate,
  onSaved,
  onCheckImpact,
}: AvailabilityModalProps) {
  const { confirm } = useFeedback()
  useModalBehavior(isOpen, onClose)
  const [resourceId, setResourceId] = useState(initialResourceId || (resources[0]?.resource_id || ''))
  const [startDate, setStartDate] = useState(initialDate || (dates[0] || ''))
  const [endDate, setEndDate] = useState(initialDate || (dates[0] || ''))
  const [status, setStatus] = useState<AvailabilityStatus>('UNAVAILABLE')
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('15:00')
  const [endTime, setEndTime] = useState('17:00')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editingWindow) {
      setResourceId(editingWindow.resource_id)
      setStartDate(editingWindow.start_date)
      setEndDate(editingWindow.end_date)
      setStatus(editingWindow.status)
      setNotes(editingWindow.notes || '')
      setAllDay(editingWindow.all_day)
      if (!editingWindow.all_day) {
        setStartTime(editingWindow.start_time || '09:00')
        setEndTime(editingWindow.end_time || '17:00')
      }
    } else {
      if (initialResourceId) setResourceId(initialResourceId)
      if (initialDate) {
        setStartDate(initialDate)
        setEndDate(initialDate)
      }
    }
  }, [editingWindow, initialResourceId, initialDate])

  if (!isOpen) return null

  const selectedResource = resources.find((r) => r.resource_id === resourceId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!resourceId) {
      setError('Please select a resource')
      return
    }
    if (!startDate || !endDate) {
      setError('Please specify start and end dates')
      return
    }
    if (startDate > endDate) {
      setError('Start date cannot be after end date')
      return
    }
    if (!allDay && startDate === endDate && endTime <= startTime) {
      setError('End time must be after the start time')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const res = await saveAvailabilityWindowAction({
      projectId,
      id: editingWindow?.id,
      resource_id: resourceId,
      resource_name: selectedResource?.resource_name || 'Resource',
      resource_type: selectedResource?.resource_type || 'PERSON',
      start_date: startDate,
      end_date: endDate,
      all_day: allDay,
      start_time: allDay ? null : startTime,
      end_time: allDay ? null : endTime,
      status,
      notes,
    })

    setIsSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else {
      onSaved?.(currentQuery())
      onClose()
    }
  }

  function currentQuery(): ImpactQuery {
    return {
      resourceId,
      startDate,
      endDate,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      status,
    }
  }

  async function handleDelete() {
    if (!editingWindow) return
    const ok = await confirm({ title: 'Remove this availability window?', confirmLabel: 'Remove', destructive: true })
    if (!ok) return

    setIsSubmitting(true)
    const res = await deleteAvailabilityWindowAction(projectId, editingWindow.id)
    setIsSubmitting(false)

    if (res.error) {
      setError(res.error)
    } else {
      onSaved?.(null)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-card/60">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-emerald-700 dark:text-emerald-400" />
            <h3 className="text-base font-bold text-foreground tracking-tight">
              {editingWindow ? 'Edit Availability Window' : 'Set Availability / Blackout'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resource Selector */}
          <div className="space-y-1.5">
            <Label className="text-xs text-subtle-foreground font-medium">Target Resource</Label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-border-strong"
            >
              {resources.map((res) => (
                <option key={res.resource_id} value={res.resource_id}>
                  {res.resource_name} ({res.resource_type})
                </option>
              ))}
            </select>
          </div>

          {/* All day vs specific hours */}
          <div role="radiogroup" aria-label="Duration" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-medium">
            {[
              { value: true, label: 'All day' },
              { value: false, label: 'Specific hours' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={allDay === o.value}
                onClick={() => setAllDay(o.value)}
                className={`py-1.5 rounded-md cursor-pointer transition-colors ${
                  allDay === o.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-subtle-foreground font-medium">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-card border-border text-sm text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-subtle-foreground font-medium">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-card border-border text-sm text-foreground"
              />
            </div>
          </div>

          {!allDay && (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-subtle-foreground font-medium">From</Label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-card border-border text-sm text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-subtle-foreground font-medium">To</Label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-card border-border text-sm text-foreground"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {startDate === endDate
                  ? 'Times are in the production’s time zone.'
                  : `From ${startTime} on the start date until ${endTime} on the end date (production time zone).`}
              </p>
            </div>
          )}

          {/* Status Options Radio Grid */}
          <div className="space-y-1.5">
            <Label className="text-xs text-subtle-foreground font-medium">Availability Status</Label>
            <div className="grid grid-cols-1 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                    status === opt.value
                      ? `${opt.color} ring-1 ring-white/20`
                      : 'bg-card/60 border-border/80 text-muted-foreground hover:border-border-strong hover:text-foreground'
                  }`}
                >
                  <span className="font-semibold text-xs">{opt.label}</span>
                  <span className="text-[11px] opacity-80">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reason / Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs text-subtle-foreground font-medium">Notes / Reason (Optional)</Label>
            <Input
              type="text"
              placeholder="e.g. Prior festival booking, equipment maintenance, flight window"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-card border-border text-sm text-foreground"
            />
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/80">
            {editingWindow ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="gap-1.5"
              >
                <Trash2 className="size-3.5" />
                <span>Remove</span>
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              {onCheckImpact && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCheckImpact(currentQuery())}
                  disabled={!resourceId || !startDate || !endDate}
                  title="See which scheduled scenes this would affect, without saving"
                >
                  Check impact
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-md shadow-emerald-950"
              >
                {isSubmitting ? 'Saving...' : 'Save Availability Window'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
