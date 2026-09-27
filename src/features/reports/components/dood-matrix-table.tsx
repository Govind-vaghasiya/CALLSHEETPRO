'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import type { DoodResourceRow, DoodStatusCode } from '../types'

interface DoodMatrixTableProps {
  shootDays: Array<{ id: string; day_number: number; shoot_date: string }>
  rows: DoodResourceRow[]
  title: string
}

export function DoodMatrixTable({ shootDays, rows, title }: DoodMatrixTableProps) {
  function renderStatusCode(code: DoodStatusCode) {
    if (!code) {
      return <span className="text-muted-foreground font-mono text-[10px]">—</span>
    }

    switch (code) {
      case 'SW':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
            SW
          </span>
        )
      case 'W':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            W
          </span>
        )
      case 'WF':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/40">
            WF
          </span>
        )
      case 'SWF':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40">
            SWF
          </span>
        )
      case 'H':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
            H
          </span>
        )
      case 'T':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40">
            T
          </span>
        )
      case 'WD':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40">
            WD
          </span>
        )
      default:
        return <span className="text-muted-foreground font-mono text-[10px]">{code}</span>
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground tracking-tight">{title}</h3>
        <span className="text-xs text-muted-foreground font-mono">{rows.length} Items Listed</span>
      </div>

      <div className="border border-border/80 rounded-2xl bg-background overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            {/* Table Header */}
            <thead>
              <tr className="bg-card/90 border-b border-border text-xs font-mono text-muted-foreground">
                <th className="p-3 sticky left-0 z-20 bg-card min-w-[50px] text-center border-r border-border/80">
                  ID
                </th>
                <th className="p-3 sticky left-[50px] z-20 bg-card min-w-[180px] border-r border-border/80">
                  Character / Name
                </th>

                {/* Shoot Day Columns */}
                {shootDays.map((sd) => {
                  const dateObj = new Date(sd.shoot_date + 'T00:00:00')
                  const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                  const monthDayStr = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

                  return (
                    <th
                      key={sd.id}
                      className="p-2 text-center min-w-[65px] border-r border-border/40 bg-card/50"
                    >
                      <div className="text-[9px] text-muted-foreground">{dayStr.toUpperCase()}</div>
                      <div className="text-xs text-foreground font-bold">D{sd.day_number}</div>
                      <div className="text-[9px] text-muted-foreground">{monthDayStr}</div>
                    </th>
                  )
                })}

                {/* Totals Columns */}
                <th className="p-2.5 text-center min-w-[60px] bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-r border-border">
                  WORK
                </th>
                <th className="p-2.5 text-center min-w-[60px] bg-amber-950/20 text-amber-700 dark:text-amber-400 border-r border-border">
                  HOLD
                </th>
                <th className="p-2.5 text-center min-w-[60px] bg-sky-950/20 text-sky-700 dark:text-sky-400">
                  TRVL
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/50 text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={shootDays.length + 5} className="p-8 text-center text-muted-foreground font-mono">
                    No resources available for DOOD calculation.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.resource_id} className="hover:bg-card/40 transition-colors">
                    {/* ID */}
                    <td className="p-2.5 text-center font-mono text-muted-foreground sticky left-0 z-10 bg-background border-r border-border/80">
                      {row.id_number || '—'}
                    </td>

                    {/* Character / Name */}
                    <td className="p-2.5 sticky left-[50px] z-10 bg-background border-r border-border/80">
                      <div className="font-semibold text-foreground">{row.resource_name}</div>
                      {row.character_name && (
                        <div className="text-[11px] text-muted-foreground font-mono">{row.character_name}</div>
                      )}
                    </td>

                    {/* Daily Status Cells */}
                    {shootDays.map((sd) => {
                      const status = row.daily_statuses[sd.id] || null
                      return (
                        <td key={sd.id} className="p-1.5 text-center border-r border-border/30">
                          {renderStatusCode(status)}
                        </td>
                      )
                    })}

                    {/* Totals */}
                    <td className="p-2 text-center font-bold font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-950/10 border-r border-border">
                      {row.total_work_days}
                    </td>
                    <td className="p-2 text-center font-bold font-mono text-amber-700 dark:text-amber-400 bg-amber-950/10 border-r border-border">
                      {row.total_hold_days}
                    </td>
                    <td className="p-2 text-center font-bold font-mono text-sky-700 dark:text-sky-400 bg-sky-950/10">
                      {row.total_travel_days}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
