'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Calendar, FileText, Film, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CallSheetPaper } from '@/features/callsheets/components/call-sheet-paper'
import type { CallSheetFullData } from '@/features/callsheets/lib/build-call-sheet'
import type { ProjectScheduleData } from '@/features/scheduling/actions'
import type { DoodReportData } from '@/features/reports/types'
import { DoodMatrixTable } from '@/features/reports/components/dood-matrix-table'
import { getStripColorClasses } from '@/features/scheduling/lib/strip-colors'

type Tab = 'CALL_SHEET' | 'STRIPBOARD' | 'DOOD'

interface GuestViewerProps {
  token: string
  projectName: string
  callSheet: CallSheetFullData | null
  publishedDays: Array<{ id: string; label: string }>
  canViewCallSheets: boolean
  schedule: ProjectScheduleData | null
  dood: DoodReportData | null
}

/** Read-only view of a production for people without an account. */
export function GuestViewer({
  token,
  projectName,
  callSheet,
  publishedDays,
  canViewCallSheets,
  schedule,
  dood,
}: GuestViewerProps) {
  const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
    ...(canViewCallSheets ? [{ id: 'CALL_SHEET' as const, label: 'Call Sheets', icon: FileText }] : []),
    ...(schedule ? [{ id: 'STRIPBOARD' as const, label: 'Shooting Schedule', icon: Calendar }] : []),
    ...(dood ? [{ id: 'DOOD' as const, label: 'Day Out of Days', icon: Film }] : []),
  ]
  const [activeTab, setActiveTab] = useState<Tab>(tabs[0]?.id || 'CALL_SHEET')

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="no-print border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">{projectName}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
              Read-only
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Shared by the production office via CallSheetPro</p>
        </div>
        <Button type="button" variant="outline" onClick={() => window.print()} className="text-xs h-9 gap-1.5 cursor-pointer">
          <Printer className="size-3.5" />
          Print / Save PDF
        </Button>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {tabs.length > 1 && (
          <nav className="no-print flex flex-wrap items-center gap-2 border-b border-border pb-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="size-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {activeTab === 'CALL_SHEET' && canViewCallSheets && (
          <section className="space-y-4">
            {publishedDays.length === 0 || !callSheet ? (
              <p className="text-sm text-muted-foreground">No call sheets have been published yet.</p>
            ) : (
              <>
                {publishedDays.length > 1 && (
                  <div className="no-print flex flex-wrap gap-2">
                    {publishedDays.map((d) => (
                      <Link
                        key={d.id}
                        href={`/guest/${token}?day=${d.id}`}
                        className={`px-3 py-1.5 rounded-lg border text-xs ${
                          d.id === callSheet.currentDay.id
                            ? 'border-indigo-500 bg-indigo-500/10 text-foreground'
                            : 'border-border text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {d.label}
                      </Link>
                    ))}
                  </div>
                )}
                {callSheet.record.status === 'REVISED' && (
                  <p className="no-print text-xs text-amber-700 dark:text-amber-400">
                    This call sheet has changed since it was last published.
                  </p>
                )}
                <CallSheetPaper data={callSheet} />
              </>
            )}
          </section>
        )}

        {activeTab === 'STRIPBOARD' && schedule && (
          <section className="space-y-4">
            {schedule.shootDays.length === 0 && <p className="text-sm text-muted-foreground">No shoot days scheduled yet.</p>}
            {schedule.shootDays.map((day) => (
              <div key={day.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2 border-b border-border flex items-center justify-between text-sm">
                  <span className="font-semibold">Day {day.day_number}</span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(`${day.shoot_date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {day.call_time ? ` · call ${day.call_time.slice(0, 5)}` : ''}
                  </span>
                </div>
                <div className="p-2 space-y-1.5">
                  {day.scenes.length === 0 && <p className="text-xs text-muted-foreground p-2">No scenes</p>}
                  {day.scenes.map((s) => (
                    <div
                      key={s.assignmentId}
                      className={`px-3 py-2 rounded-lg border text-xs font-mono flex items-center gap-3 ${
                        getStripColorClasses(s.scene.int_ext, s.scene.time_of_day).container
                      }`}
                    >
                      <span className="font-black">#{s.scene.scene_number}</span>
                      <span className="truncate uppercase">{s.scene.heading}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'DOOD' && dood && (
          <section className="space-y-6">
            <DoodMatrixTable shootDays={dood.shoot_days} rows={dood.cast_rows} title="Cast & Crew" />
            <DoodMatrixTable shootDays={dood.shoot_days} rows={dood.location_rows} title="Locations" />
            <DoodMatrixTable shootDays={dood.shoot_days} rows={dood.equipment_rows} title="Equipment & Props" />
          </section>
        )}
      </main>
    </div>
  )
}
