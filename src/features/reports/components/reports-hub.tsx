'use client'

import React, { useState } from 'react'
import { FileText, Download, Printer, Users, Camera, MapPin, Table } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { DoodReportData } from '../types'
import { DoodMatrixTable } from './dood-matrix-table'

interface ReportsHubProps {
  reportData: DoodReportData
}

export function ReportsHub({ reportData }: ReportsHubProps) {
  const [activeTab, setActiveTab] = useState<'CAST' | 'EQUIPMENT' | 'LOCATION'>('CAST')

  function handleExportCsv() {
    const activeRows =
      activeTab === 'CAST'
        ? reportData.cast_rows
        : activeTab === 'EQUIPMENT'
        ? reportData.equipment_rows
        : reportData.location_rows

    const headers = [
      'ID',
      'Name',
      'Character/Notes',
      ...reportData.shoot_days.map((sd) => `Day ${sd.day_number} (${sd.shoot_date})`),
      'Total Work',
      'Total Hold',
      'Total Travel',
    ]

    const csvLines = [headers.join(',')]

    activeRows.forEach((row) => {
      const line = [
        row.id_number || '',
        `"${row.resource_name}"`,
        `"${row.character_name || ''}"`,
        ...reportData.shoot_days.map((sd) => row.daily_statuses[sd.id] || ''),
        row.total_work_days,
        row.total_hold_days,
        row.total_travel_days,
      ]
      csvLines.push(line.join(','))
    })

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${reportData.project_name.replace(/\s+/g, '_')}_${activeTab}_DOOD.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Printable CSS rules */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
          }
          nav, header, button, .no-print {
            display: none !important;
          }
          .print-area {
            padding: 0 !important;
            margin: 0 !important;
          }
          table {
            border: 1px solid #ccc !important;
            color: black !important;
          }
          th, td {
            border: 1px solid #ddd !important;
            color: black !important;
            background: white !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-background/80 border border-border/80 p-5 rounded-2xl backdrop-blur-md no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              Production Reports & DOOD Suite
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
              DAY-OUT-OF-DAYS (DOOD)
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Generate industry-standard Day-Out-of-Days matrix reports for cast, equipment, and locations.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="border-border text-subtle-foreground hover:text-foreground hover:bg-card gap-1.5"
          >
            <Download className="size-4 text-emerald-700 dark:text-emerald-400" />
            <span>Export CSV</span>
          </Button>

          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium shadow-md shadow-emerald-950"
          >
            <Printer className="size-4" />
            <span>Print Report (PDF)</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/80 pb-3 no-print">
        <button
          onClick={() => setActiveTab('CAST')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'CAST'
              ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'bg-card/60 text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          <Users className="size-4" />
          <span>Cast DOOD Report ({reportData.cast_rows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('EQUIPMENT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'EQUIPMENT'
              ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'bg-card/60 text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          <Camera className="size-4" />
          <span>Equipment &amp; Props DOOD ({reportData.equipment_rows.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('LOCATION')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'LOCATION'
              ? 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'bg-card/60 text-muted-foreground hover:text-foreground border border-transparent'
          }`}
        >
          <MapPin className="size-4" />
          <span>Location DOOD ({reportData.location_rows.length})</span>
        </button>
      </div>

      {/* Status Legend Bar */}
      <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-background border border-border text-xs text-muted-foreground flex-wrap no-print">
        <span className="font-semibold text-subtle-foreground">DOOD Code Key:</span>
        <div className="flex items-center gap-3 flex-wrap font-mono text-[11px]">
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold">
            SW = Start Work
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold">
            W = Work
          </span>
          <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/40 font-bold">
            WF = Work Finish
          </span>
          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 font-bold">
            SWF = Single Day Role
          </span>
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 font-bold">
            H = Hold Day
          </span>
          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40 font-bold">
            T = Travel Day
          </span>
        </div>
      </div>

      {/* Active DOOD Table */}
      <div className="print-area">
        {activeTab === 'CAST' && (
          <DoodMatrixTable
            title="Cast Day-Out-of-Days Matrix"
            shootDays={reportData.shoot_days}
            rows={reportData.cast_rows}
          />
        )}

        {activeTab === 'EQUIPMENT' && (
          <DoodMatrixTable
            title="Equipment & Camera Gear Day-Out-of-Days"
            shootDays={reportData.shoot_days}
            rows={reportData.equipment_rows}
          />
        )}

        {activeTab === 'LOCATION' && (
          <DoodMatrixTable
            title="Location Utilization & Moves DOOD"
            shootDays={reportData.shoot_days}
            rows={reportData.location_rows}
          />
        )}
      </div>
    </div>
  )
}
