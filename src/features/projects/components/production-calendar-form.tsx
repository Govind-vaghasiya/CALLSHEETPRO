'use client'

import React, { useEffect, useState } from 'react'
import { CalendarDays, CalendarRange, Loader2, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFeedback } from '@/components/ui/feedback-provider'
import { createClient } from '@/lib/supabase/client'
import { loadSchedule } from '@/features/scheduling/lib/load-schedule'
import { DEFAULT_CALENDAR, WEEKDAY_NAMES, planReflow, type Holiday, type ProductionCalendar } from '@/features/scheduling/lib/production-calendar'
import {
  applyDatePlan,
  loadProductionCalendar,
  numbersFixed,
  saveProductionCalendar,
  toCalendarDays,
} from '@/features/scheduling/lib/production-calendar-run'

const fmt = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/**
 * Work week + holidays. Shoot-day pushes, "insert day off" and Smart Auto-Schedule all count
 * working days from this calendar.
 */
export function ProductionCalendarForm({ projectId }: { projectId: string }) {
  const { confirm, notify } = useFeedback()
  const [cal, setCal] = useState<ProductionCalendar>(DEFAULT_CALENDAR)
  const [stored, setStored] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [redating, setRedating] = useState(false)
  const [newHoliday, setNewHoliday] = useState<Holiday>({ date: '', label: '' })

  useEffect(() => {
    let live = true
    loadProductionCalendar(createClient(), projectId).then((c) => {
      if (!live) return
      setCal({ workDays: c.workDays, holidays: c.holidays })
      setStored(c.stored)
      setLoaded(true)
    })
    return () => {
      live = false
    }
  }, [projectId])

  const change = (next: ProductionCalendar) => {
    setCal(next)
    setDirty(true)
  }

  const toggleDay = (d: number) => {
    const on = cal.workDays.includes(d)
    if (on && cal.workDays.length === 1) return notify('Keep at least one shooting day in the week.', 'error')
    change({ ...cal, workDays: on ? cal.workDays.filter((x) => x !== d) : [...cal.workDays, d].sort() })
  }

  const addHoliday = () => {
    if (!newHoliday.date) return notify('Pick the holiday date.', 'error')
    if (cal.holidays.some((h) => h.date === newHoliday.date)) return notify('That date is already a holiday.', 'error')
    change({
      ...cal,
      holidays: [...cal.holidays, { date: newHoliday.date, label: newHoliday.label.trim() || 'Holiday' }].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    })
    setNewHoliday({ date: '', label: '' })
  }

  const handleSave = async () => {
    setSaving(true)
    const res = await saveProductionCalendar(projectId, cal)
    setSaving(false)
    if (!res.success) return notify(res.error || 'Could not save the calendar', 'error')
    setDirty(false)
    notify('Production calendar saved.', 'success')
  }

  // Put every movable shoot day on consecutive working dates, keeping the order
  const handleRedate = async () => {
    if (dirty) return notify('Save the calendar first.', 'error')
    setRedating(true)
    try {
      const schedule = await loadSchedule(createClient(), projectId)
      const days = toCalendarDays(schedule)
      const first = days.filter((d) => !d.fixed).map((d) => d.date).sort()[0]
      if (!first) return notify('There are no shoot days that can move.', 'info')
      const plan = planReflow(days, first, cal)
      if (!plan.moves.length) return notify('Every shoot day already fits this calendar.', 'success')
      const last = plan.moves[plan.moves.length - 1]
      const ok = await confirm({
        title: `Re-date ${plan.moves.length} shoot day${plan.moves.length > 1 ? 's' : ''}?`,
        message: [
          `Days keep their order and take consecutive working days from ${fmt(first)}, skipping days off and holidays.`,
          `Last moved day: Day ${last.dayNumber} → ${fmt(last.to)}.`,
          'Shot, shooting and locked days keep their dates.',
          ...plan.warnings,
          'A backup version is saved first.',
        ].join('\n'),
        confirmLabel: 'Re-date schedule',
      })
      if (!ok) return
      const res = await applyDatePlan(projectId, plan, 'Re-dated schedule to the production calendar', numbersFixed(schedule))
      if (!res.success) notify(res.error || 'Could not re-date the schedule', 'error')
      else notify(`${plan.moves.length} shoot days re-dated. A backup version was saved.`, 'success')
    } finally {
      setRedating(false)
    }
  }

  return (
    <Card className="border-border bg-card/60 shadow-xl">
      <CardHeader className="border-b border-border/80 pb-4">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono uppercase font-semibold">
          <CalendarDays className="size-4" />
          <span>Scheduling</span>
        </div>
        <CardTitle className="text-lg text-foreground">Production calendar</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Which weekdays you shoot and which dates are holidays. Pushing a day, inserting a day off and Smart Auto-Schedule
          count working days from this calendar.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {!stored && (
          <p className="text-sm rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-300">
            Run database migration <code>022_production_calendar.sql</code> in Supabase to save a calendar. Until then a six-day
            week (Sunday off) is used.
          </p>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Shooting days</div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_NAMES.map((name, d) => {
              const on = cal.workDays.includes(d)
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  disabled={!loaded}
                  onClick={() => toggleDay(d)}
                  className={`w-14 h-9 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${
                    on
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-300'
                      : 'border-border text-muted-foreground hover:text-foreground line-through decoration-1'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {cal.workDays.length}-day week · days off:{' '}
            {[0, 1, 2, 3, 4, 5, 6].filter((d) => !cal.workDays.includes(d)).map((d) => WEEKDAY_NAMES[d]).join(', ') || 'none'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Holidays &amp; dark days</div>
          {cal.holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground">No holidays yet. Add festival days, public holidays or planned dark days.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {cal.holidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground w-36">{fmt(h.date)}</span>
                  <span className="flex-1 text-foreground truncate">{h.label}</span>
                  <button
                    type="button"
                    onClick={() => change({ ...cal, holidays: cal.holidays.filter((x) => x.date !== h.date) })}
                    className="p-1.5 rounded text-muted-foreground hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    aria-label={`Remove ${h.label}`}
                    title="Remove"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={newHoliday.date}
              onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-sm"
              aria-label="Holiday date"
            />
            <input
              type="text"
              value={newHoliday.label}
              onChange={(e) => setNewHoliday({ ...newHoliday, label: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addHoliday()
                }
              }}
              placeholder="Name (e.g. Diwali)"
              className="h-9 px-2 rounded-md border border-border bg-background text-foreground text-sm flex-1 min-w-40"
              aria-label="Holiday name"
            />
            <Button type="button" variant="outline" onClick={addHoliday} className="h-9 cursor-pointer">
              <Plus className="size-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border/80 pt-4 pb-4 flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleRedate}
          disabled={redating || !loaded}
          className="cursor-pointer"
          title="Put every movable shoot day on consecutive working days, keeping the order"
        >
          {redating ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <CalendarRange className="size-4 mr-1.5" />}
          Re-date schedule to this calendar
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty || !stored}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
        >
          {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
          Save calendar
        </Button>
      </CardFooter>
    </Card>
  )
}
