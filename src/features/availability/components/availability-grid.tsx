'use client'

import React, { useState } from 'react'
import {
  Calendar as CalendarIcon,
  Search,
  Filter,
  Plus,
  AlertTriangle,
  Clock,
  UserCheck,
  Plane,
  ShieldAlert,
  HelpCircle,
  Film,
  CalendarCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { AvailabilityStatus, ResourceType } from '@/types/database'
import type { AvailabilityGridData, ResourceAvailabilityRow, ResourceAvailabilityWindow } from '../types'
import { AvailabilityModal } from './availability-modal'
import { AvailabilityImpactModal } from './availability-impact-modal'
import type { ImpactQuery } from './availability-modal'

interface AvailabilityGridProps {
  initialData: AvailabilityGridData
  projectId: string
}

export function AvailabilityGrid({ initialData, projectId }: AvailabilityGridProps) {
  const [data, setData] = useState<AvailabilityGridData>(initialData)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedWindow, setSelectedWindow] = useState<ResourceAvailabilityWindow | null>(null)
  const [cellSelection, setCellSelection] = useState<{ resourceId?: string; date?: string } | null>(null)
  const [impactTarget, setImpactTarget] = useState<ImpactQuery | null>(null)

  // Filter resources
  const filteredResources = data.resources.filter((res) => {
    const matchesSearch =
      res.resource_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (res.display_name && res.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    
    if (typeFilter === 'ALL') return matchesSearch
    if (typeFilter === 'CAST') return matchesSearch && res.resource_type === 'PERSON'
    if (typeFilter === 'LOCATION') return matchesSearch && res.resource_type === 'LOCATION'
    if (typeFilter === 'EQUIPMENT') return matchesSearch && res.resource_type === 'EQUIPMENT'
    return matchesSearch
  })

  // Summary Metrics
  const totalResources = data.resources.length
  let totalBlackouts = 0
  let totalHolds = 0
  let totalTravel = 0

  data.resources.forEach((r) => {
    r.availability_windows.forEach((w) => {
      if (w.status === 'UNAVAILABLE') totalBlackouts++
      if (w.status === 'HOLD') totalHolds++
      if (w.status === 'TRAVEL') totalTravel++
    })
  })

  function handleCellClick(resourceId: string, date: string, window?: ResourceAvailabilityWindow) {
    if (window) {
      setSelectedWindow(window)
      setCellSelection(null)
    } else {
      setSelectedWindow(null)
      setCellSelection({ resourceId, date })
    }
    setIsModalOpen(true)
  }

  function handleOpenNewModal() {
    setSelectedWindow(null)
    setCellSelection(null)
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Metrics Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-background/80 border border-border/80 p-5 rounded-2xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              Availability & Blackout Calendar
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
              {data.dates.length} SHOOTING DAYS MATRIX
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Manage availability status windows for cast, crew, gear, and locations. Cross-referenced in real-time with stripboard bookings.
          </p>
        </div>

        {/* Quick Stats Grid */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          <div className="bg-card/90 border border-border px-3 py-2 rounded-xl text-center shrink-0 min-w-[100px]">
            <span className="text-[10px] text-muted-foreground font-mono uppercase block">Total Resources</span>
            <span className="text-lg font-bold text-foreground">{totalResources}</span>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl text-center shrink-0 min-w-[100px]">
            <span className="text-[10px] text-rose-700 dark:text-rose-400 font-mono uppercase block">Blackouts</span>
            <span className="text-lg font-bold text-rose-700 dark:text-rose-300">{totalBlackouts}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl text-center shrink-0 min-w-[100px]">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono uppercase block">Holds</span>
            <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{totalHolds}</span>
          </div>
          <div className="bg-sky-500/10 border border-sky-500/20 px-3 py-2 rounded-xl text-center shrink-0 min-w-[100px]">
            <span className="text-[10px] text-sky-700 dark:text-sky-400 font-mono uppercase block">Travel Days</span>
            <span className="text-lg font-bold text-sky-700 dark:text-sky-300">{totalTravel}</span>
          </div>
        </div>
      </div>

      {/* Filter Ribbon & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search resource..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card/80 border-border text-xs text-foreground"
            />
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center bg-card border border-border rounded-lg p-0.5">
            {['ALL', 'CAST', 'LOCATION', 'EQUIPMENT'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  typeFilter === type
                    ? 'bg-muted text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Window Trigger */}
          <Button
            onClick={handleOpenNewModal}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium shadow-md shadow-emerald-950"
          >
            <Plus className="size-4" />
            <span>Add Availability Override</span>
          </Button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="border border-border/80 rounded-2xl bg-background overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            {/* Table Header with Shoot Dates */}
            <thead>
              <tr className="bg-card/90 border-b border-border text-xs font-mono text-muted-foreground">
                <th className="p-3.5 sticky left-0 z-20 bg-card min-w-[200px] border-r border-border/80">
                  Resource Name
                </th>
                {data.dates.map((dateStr) => {
                  const shootDay = data.shoot_days.find((s) => s.shoot_date === dateStr)
                  const dateObj = new Date(dateStr + 'T00:00:00')
                  const formattedDay = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
                  const formattedMonthDay = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

                  return (
                    <th
                      key={dateStr}
                      className={`p-2.5 text-center min-w-[100px] border-r border-border/50 ${
                        shootDay ? 'bg-emerald-950/20 font-semibold text-emerald-700 dark:text-emerald-400' : ''
                      }`}
                    >
                      <div className="text-[10px] text-muted-foreground">{formattedDay.toUpperCase()}</div>
                      <div className="text-xs text-foreground font-bold">{formattedMonthDay}</div>
                      {shootDay && (
                        <div className="mt-1">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono border border-emerald-500/30">
                            DAY {shootDay.day_number}
                          </span>
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border/50 text-xs">
              {filteredResources.length === 0 ? (
                <tr>
                  <td
                    colSpan={data.dates.length + 1}
                    className="p-12 text-center text-muted-foreground font-mono"
                  >
                    No matching resources found.
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => (
                  <tr key={res.resource_id} className="hover:bg-card/40 transition-colors">
                    {/* Resource Name Sticky Left Column */}
                    <td className="p-3 sticky left-0 z-10 bg-background border-r border-border/80 font-medium">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-foreground font-semibold">{res.resource_name}</div>
                          {res.display_name && (
                            <div className="text-[11px] text-muted-foreground">{res.display_name}</div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-border text-muted-foreground"
                        >
                          {res.resource_type}
                        </Badge>
                      </div>
                    </td>

                    {/* Date Cells */}
                    {data.dates.map((dateStr) => {
                      // Check for availability window on this date
                      const window = res.availability_windows.find(
                        (w) => dateStr >= w.start_date && dateStr <= w.end_date
                      )

                      // Check for shoot day booking
                      const booking = res.bookings.find((b) => b.shoot_date === dateStr)

                      return (
                        <td
                          key={dateStr}
                          onClick={() => handleCellClick(res.resource_id, dateStr, window)}
                          className="p-1 text-center border-r border-border/40 cursor-pointer hover:bg-muted/50 transition-all relative h-14"
                        >
                          <div className="h-full w-full flex flex-col items-center justify-center gap-1 rounded-lg">
                            {/* Render Status Pill if Window Exists */}
                            {window ? (
                              <div
                                className={`w-full py-1 px-1.5 rounded-md text-[10px] font-semibold border flex flex-col items-center justify-center transition-transform hover:scale-105 shadow-sm ${
                                  window.status === 'UNAVAILABLE'
                                    ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                                    : window.status === 'HOLD'
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                                    : window.status === 'TRAVEL'
                                    ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/40'
                                    : window.status === 'PARTIAL'
                                    ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/40'
                                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                                }`}
                                title={[
                                  window.status,
                                  !window.all_day
                                    ? `${dateStr === window.start_date ? window.start_time : '00:00'}–${dateStr === window.end_date ? window.end_time : '24:00'}`
                                    : null,
                                  window.notes,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              >
                                <div className="flex items-center gap-1 truncate max-w-full">
                                  {window.status === 'UNAVAILABLE' && <ShieldAlert className="size-3 shrink-0" />}
                                  {window.status === 'TRAVEL' && <Plane className="size-3 shrink-0" />}
                                  <span className="truncate">
                                    {window.all_day
                                      ? window.status
                                      : `${dateStr === window.start_date ? window.start_time : '00:00'}–${dateStr === window.end_date ? window.end_time : '24:00'}`}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="group-hover:opacity-100 opacity-40 text-emerald-600/80 dark:text-emerald-500/80 text-[10px] flex items-center gap-1 font-mono">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                <span>OK</span>
                              </div>
                            )}

                            {/* Booking Badge Indicator */}
                            {booking && (
                              <span className="text-[9px] font-mono text-muted-foreground bg-muted/90 border border-border-strong/80 px-1 py-0.2 rounded">
                                Booked Day {booking.day_number}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend & Guidance Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-background border border-border text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-subtle-foreground">Status Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500" />
            <span className="text-rose-700 dark:text-rose-300">Unavailable / Blackout</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            <span className="text-amber-700 dark:text-amber-300">On Hold</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" />
            <span className="text-sky-700 dark:text-sky-300">Travel</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-orange-500" />
            <span className="text-orange-700 dark:text-orange-300">Partial</span>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground font-mono">
          Click any grid cell to create or update resource availability
        </div>
      </div>

      {/* Modal */}
      <AvailabilityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        projectId={projectId}
        resources={data.resources}
        dates={data.dates}
        editingWindow={selectedWindow}
        initialResourceId={cellSelection?.resourceId}
        initialDate={cellSelection?.date}
        onSaved={async (saved) => {
          // Refresh grid data after save
          const { getAvailabilityDataAction } = await import('../actions')
          const fresh = await getAvailabilityDataAction(projectId)
          setData(fresh)
          // Blocking windows: show straight away what they hit in the schedule
          if (saved && ['UNAVAILABLE', 'TRAVEL', 'PARTIAL'].includes(saved.status)) setImpactTarget(saved)
        }}
        onCheckImpact={(query) => setImpactTarget(query)}
      />

      {/* Impact Inspector Modal */}
      {impactTarget && (
        <AvailabilityImpactModal
          isOpen={!!impactTarget}
          onClose={() => setImpactTarget(null)}
          projectId={projectId}
          resourceId={impactTarget.resourceId}
          startDate={impactTarget.startDate}
          endDate={impactTarget.endDate}
          startTime={impactTarget.startTime}
          endTime={impactTarget.endTime}
        />
      )}
    </div>
  )
}
