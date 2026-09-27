'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addDays
} from 'date-fns'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from './button'

interface DatePickerProps {
  id?: string
  name: string
  defaultValue?: string
  placeholder?: string
  minDate?: string
  className?: string
  required?: boolean
  onChange?: (dateStr: string) => void
}

export function DatePicker({
  id,
  name,
  defaultValue = '',
  placeholder = 'Select date...',
  className = '',
  required = false,
  onChange,
}: DatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (!defaultValue) return null
    const parsed = new Date(defaultValue + 'T00:00:00')
    return isNaN(parsed.getTime()) ? null : parsed
  })

  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState<Date>(() => selectedDate || new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = (day: Date) => {
    setSelectedDate(day)
    const formatted = format(day, 'yyyy-MM-dd')
    onChange?.(formatted)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDate(null)
    onChange?.('')
  }

  const handlePreset = (offsetDays: number) => {
    const target = addDays(new Date(), offsetDays)
    setSelectedDate(target)
    setViewDate(target)
    onChange?.(format(target, 'yyyy-MM-dd'))
    setIsOpen(false)
  }

  // Days grid
  const monthStart = startOfMonth(viewDate)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: startDate, end: endDate })

  const valueFormatted = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input for HTML form submissions */}
      <input
        type="hidden"
        id={id}
        name={name}
        value={valueFormatted}
        required={required}
      />

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen && selectedDate) {
            setViewDate(selectedDate)
          }
          setIsOpen(!isOpen)
        }}
        className={`w-full h-11 rounded-lg border border-border bg-background px-3.5 text-left text-sm flex items-center justify-between text-foreground transition-all hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer ${
          isOpen ? 'ring-2 ring-amber-500 border-transparent' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <CalendarIcon className="size-4 text-amber-700 dark:text-amber-400 shrink-0" />
          {selectedDate ? (
            <span className="font-medium text-foreground">
              {format(selectedDate, 'EEE, MMM d, yyyy')}
            </span>
          ) : (
            <span className="text-faint">{placeholder}</span>
          )}
        </div>

        {selectedDate && (
          <div
            role="button"
            onClick={handleClear}
            title="Clear date"
            className="p-1 text-faint hover:text-subtle-foreground rounded hover:bg-muted/60 cursor-pointer"
          >
            <X className="size-3.5" />
          </div>
        )}
      </button>

      {/* Calendar Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-76 rounded-xl border border-border bg-card/95 p-3.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          {/* Quick Presets */}
          <div className="flex items-center gap-1 pb-3 mb-3 border-b border-border text-[11px] overflow-x-auto">
            <button
              type="button"
              onClick={() => handlePreset(0)}
              className="px-2 py-1 rounded bg-muted text-subtle-foreground hover:bg-amber-500 hover:text-zinc-950 font-medium transition-colors cursor-pointer shrink-0"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset(14)}
              className="px-2 py-1 rounded bg-muted text-subtle-foreground hover:bg-amber-500 hover:text-zinc-950 font-medium transition-colors cursor-pointer shrink-0"
            >
              +2 Wks
            </button>
            <button
              type="button"
              onClick={() => handlePreset(30)}
              className="px-2 py-1 rounded bg-muted text-subtle-foreground hover:bg-amber-500 hover:text-zinc-950 font-medium transition-colors cursor-pointer shrink-0"
            >
              +1 Mo
            </button>
            <button
              type="button"
              onClick={() => handlePreset(60)}
              className="px-2 py-1 rounded bg-muted text-subtle-foreground hover:bg-amber-500 hover:text-zinc-950 font-medium transition-colors cursor-pointer shrink-0"
            >
              +2 Mos
            </button>
          </div>

          {/* Month / Year Header */}
          <div className="flex items-center justify-between pb-2">
            <span className="text-sm font-semibold text-foreground tracking-wide">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewDate(subMonths(viewDate, 1))}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Day of Week Labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-mono font-medium text-faint pb-1">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {days.map((day) => {
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
              const isCurrentMonth = isSameMonth(day, viewDate)
              const isDayToday = isToday(day)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={`size-8 rounded-lg flex items-center justify-center font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/25'
                      : isDayToday
                      ? 'border border-amber-500/60 text-amber-700 dark:text-amber-300 hover:bg-muted'
                      : isCurrentMonth
                      ? 'text-foreground hover:bg-muted hover:text-foreground'
                      : 'text-faint hover:bg-muted/50 hover:text-muted-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
