'use client'

import React, { useRef, useState } from 'react'
import { printElement } from '@/lib/print/print-document'

/** The call sheet "paper" fills the printed page: no card shadow, rounding, or screen padding. */
const CALL_SHEET_PRINT_CSS = `
  .print-area { box-shadow: none !important; border: 0 !important; border-radius: 0 !important;
    padding: 0 !important; margin: 0 !important; max-width: none !important; width: 100% !important; }
  .print-area > * { break-inside: avoid; }
  body { font-size: 11px; }
`
import type { CallSheetFullData } from '../actions'
import { getCallSheetDataAction, publishCallSheetAction } from '../actions'
import { CallSheetPaper } from './call-sheet-paper'
import { CallSheetEditorModal } from './call-sheet-editor-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Printer,
  Edit,
  Calendar,
  Send,
  RefreshCw,
} from 'lucide-react'

interface CallSheetViewProps {
  initialData: CallSheetFullData
  projectId: string
}

export function CallSheetView({ initialData, projectId }: CallSheetViewProps) {
  const [data, setData] = useState<CallSheetFullData>(initialData)
  const [isLoadingDay, setIsLoadingDay] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const handlePublish = async () => {
    setIsPublishing(true)
    setPublishError(null)
    const res = await publishCallSheetAction(projectId, data.currentDay.id)
    if (!res.success) setPublishError(res.error || 'Could not publish')
    await handleRefresh()
    setIsPublishing(false)
  }

  const { shootDays, currentDay } = data

  // Handle Day Switcher Change
  const handleSelectDay = async (dayId: string) => {
    setIsLoadingDay(true)
    const freshData = await getCallSheetDataAction(projectId, dayId)
    if (freshData) {
      setData(freshData)
    }
    setIsLoadingDay(false)
  }

  // Refresh current day data
  const handleRefresh = async () => {
    setIsLoadingDay(true)
    const freshData = await getCallSheetDataAction(projectId, currentDay.id)
    if (freshData) {
      setData(freshData)
    }
    setIsLoadingDay(false)
  }

  // Print Handler
  const paperRef = useRef<HTMLDivElement>(null)
  const handlePrint = () => {
    if (!paperRef.current) return
    printElement(paperRef.current, {
      title: `${data.project.name} — Call Sheet Day ${currentDay.day_number ?? ''} (${currentDay.shoot_date})`,
      size: 'Letter',
      margin: '0.4in',
      css: CALL_SHEET_PRINT_CSS,
    })
  }

  return (
    <div className="space-y-6 w-full">

      {/* TOP CONTROL RIBBON (Hidden during print) */}
      <div className="no-print bg-background border border-border p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Day Switcher Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <Calendar className="size-4 text-amber-600 dark:text-amber-500" />
            <span className="font-bold text-foreground">Select Shoot Day:</span>
          </div>

          <select
            value={currentDay.id}
            onChange={(e) => handleSelectDay(e.target.value)}
            disabled={isLoadingDay}
            className="h-9 px-3 text-xs font-mono font-bold rounded-xl bg-card border border-border text-amber-700 dark:text-amber-400 cursor-pointer outline-none focus:border-amber-500"
          >
            {shootDays.map((day) => (
              <option key={day.id} value={day.id}>
                Day {day.day_number || 1} — {new Date(day.shoot_date).toLocaleDateString()} ({day.status})
              </option>
            ))}
          </select>

          {isLoadingDay && (
            <RefreshCw className="size-4 animate-spin text-amber-600 dark:text-amber-500" />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={data.record.status === 'PUBLISHED' ? 'success' : data.record.status === 'REVISED' ? 'destructive' : 'secondary'}
            className="text-[11px] font-mono"
          >
            {data.record.status === 'PUBLISHED'
              ? `Published v${data.record.version}`
              : data.record.status === 'REVISED'
              ? 'Changed since publishing'
              : 'Draft'}
          </Badge>
          {publishError && <span className="text-xs text-red-600 dark:text-red-400">{publishError}</span>}
          <Button
            type="button"
            variant="outline"
            onClick={handlePublish}
            disabled={isPublishing || data.record.status === 'PUBLISHED'}
            className="border-border text-subtle-foreground hover:text-foreground text-xs font-mono h-9 cursor-pointer"
          >
            <Send className="size-3.5 mr-1.5" />
            <span>{data.record.status === 'REVISED' ? 'Publish revision' : 'Publish'}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEditorOpen(true)}
            className="border-border text-subtle-foreground hover:text-foreground text-xs font-mono h-9 cursor-pointer"
          >
            <Edit className="size-3.5 mr-1.5" />
            <span>Edit Call Sheet</span>
          </Button>

          <Button
            type="button"
            onClick={handlePrint}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs font-mono h-9 cursor-pointer shadow-md"
          >
            <Printer className="size-4 mr-1.5" />
            <span>Print / Export PDF</span>
          </Button>
        </div>
      </div>

      {/* CALL SHEET PAPER CANVAS */}
      <div ref={paperRef}>
        <CallSheetPaper data={data} />
      </div>

      {/* Editor Modal */}
      <CallSheetEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        data={data}
        onRefresh={handleRefresh}
      />
    </div>
  )
}
