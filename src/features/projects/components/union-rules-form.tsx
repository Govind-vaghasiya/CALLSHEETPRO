'use client'

import React, { useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Utensils,
  CalendarDays,
  Award,
  CheckCircle2,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  Check,
  Zap,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export type UnionPresetKey = 'SAG_AFTRA' | 'IATSE' | 'DGA' | 'NON_UNION' | 'CUSTOM'

export interface UnionPreset {
  id: UnionPresetKey
  name: string
  fullName: string
  badgeColor: string
  minTurnaroundHours: number
  maxShootingHours: number
  mealBreakInterval: number
  maxConsecutiveWorkDays: number
  overtimeThresholdHours: number
  doubleTimeThresholdHours: number
  description: string
  rules: string[]
}

export const UNION_PRESETS: Record<UnionPresetKey, UnionPreset> = {
  SAG_AFTRA: {
    id: 'SAG_AFTRA',
    name: 'SAG-AFTRA',
    fullName: 'Screen Actors Guild — American Federation of Television & Radio Artists',
    badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30',
    minTurnaroundHours: 12,
    maxShootingHours: 10,
    mealBreakInterval: 6,
    maxConsecutiveWorkDays: 6,
    overtimeThresholdHours: 8,
    doubleTimeThresholdHours: 10,
    description: 'Strict 12-hour rest period rule for performers. 6-hour meal windows with enforced meal penalty tracking.',
    rules: [
      '12-Hour Rest Period: Strict turnaround between wrap and next call (14h for distant location).',
      'Meal Penalty: First meal must be provided within 6 hours of call time.',
      'Forced Call Penalty: Day rate multiplier applies if turnaround is breached.',
      'Mandatory Rest Day: 1 full 24-hour rest day required every 6 days.',
    ],
  },
  IATSE: {
    id: 'IATSE',
    name: 'IATSE Local 600/800',
    fullName: 'International Alliance of Theatrical Stage Employees',
    badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    minTurnaroundHours: 10,
    maxShootingHours: 12,
    mealBreakInterval: 6,
    maxConsecutiveWorkDays: 6,
    overtimeThresholdHours: 8,
    doubleTimeThresholdHours: 12,
    description: '10-hour daily turnaround (12h weekend rest). Overtime triggers after 8 hours.',
    rules: [
      '10-Hour Turnaround: Minimum rest between shifts for technical crew.',
      'Meal Breaks: 6-hour maximum interval; 30-minute grace period with agreement.',
      'Weekend Rest: 34-hour (2-day off) or 54-hour (3-day off) weekend rest period.',
      'Overtime: 1.5x pay rate after 8 hours; 2x pay rate after 12 hours.',
    ],
  },
  DGA: {
    id: 'DGA',
    name: 'DGA',
    fullName: 'Directors Guild of America',
    badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    minTurnaroundHours: 12,
    maxShootingHours: 12,
    mealBreakInterval: 6,
    maxConsecutiveWorkDays: 6,
    overtimeThresholdHours: 8,
    doubleTimeThresholdHours: 12,
    description: '12-hour turnaround for directors and assistant directors with required wrap report compliance.',
    rules: [
      '12-Hour Turnaround: Standard rest interval for DGA team.',
      'Table Read & Rehearsal Caps: Included in daily working limit.',
      'Meal Windows: 6-hour maximum from call time or previous meal.',
      'Preparation Days: Guaranteed prep days before principal photography.',
    ],
  },
  NON_UNION: {
    id: 'NON_UNION',
    name: 'Independent / Non-Union',
    fullName: 'Standard Independent Production Guidelines',
    badgeColor: 'bg-zinc-500/15 text-subtle-foreground border-zinc-500/30',
    minTurnaroundHours: 10,
    maxShootingHours: 12,
    mealBreakInterval: 6,
    maxConsecutiveWorkDays: 7,
    overtimeThresholdHours: 10,
    doubleTimeThresholdHours: 14,
    description: 'Flexible rules for indie and digital productions while respecting safety standards.',
    rules: [
      '10-Hour Turnaround: Recommended minimum rest for safety.',
      'Meal Break Window: 6-hour standard for crew wellbeing.',
      'Flexible Overtime: Custom negotiated rates after 10 hours.',
      '7-Day Maximum: Rest day strongly recommended after 6 consecutive days.',
    ],
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom Guild Rules',
    fullName: 'User Configured Guild & Production Constraints',
    badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
    minTurnaroundHours: 12,
    maxShootingHours: 10,
    mealBreakInterval: 6,
    maxConsecutiveWorkDays: 6,
    overtimeThresholdHours: 8,
    doubleTimeThresholdHours: 12,
    description: 'Tailored limits for international co-productions, regional unions, or unique agreements.',
    rules: [
      'Fully customizable rest thresholds and daily shooting caps.',
      'Manual penalty multipliers and custom meal intervals.',
    ],
  },
}

interface UnionRulesFormProps {
  initialPreset?: UnionPresetKey
  initialTurnaround?: number
  initialMaxHours?: number
  onSaveRules?: (preset: UnionPresetKey, rules: { turnaround: number; maxHours: number; mealInterval: number }) => void
}

export function UnionRulesForm({
  initialPreset = 'SAG_AFTRA',
  initialTurnaround = 12,
  initialMaxHours = 10,
  onSaveRules,
}: UnionRulesFormProps) {
  const [selectedPreset, setSelectedPreset] = useState<UnionPresetKey>(initialPreset)
  const [minTurnaround, setMinTurnaround] = useState<number>(initialTurnaround)
  const [maxHours, setMaxHours] = useState<number>(initialMaxHours)
  const [mealInterval, setMealInterval] = useState<number>(6)
  const [maxWorkDays, setMaxWorkDays] = useState<number>(6)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const preset = UNION_PRESETS[selectedPreset]

  const handlePresetSelect = (key: UnionPresetKey) => {
    setSelectedPreset(key)
    const targetPreset = UNION_PRESETS[key]
    setMinTurnaround(targetPreset.minTurnaroundHours)
    setMaxHours(targetPreset.maxShootingHours)
    setMealInterval(targetPreset.mealBreakInterval)
    setMaxWorkDays(targetPreset.maxConsecutiveWorkDays)
  }

  const handleSave = () => {
    setSaveSuccess(true)
    if (onSaveRules) {
      onSaveRules(selectedPreset, {
        turnaround: minTurnaround,
        maxHours: maxHours,
        mealInterval: mealInterval,
      })
    }
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  return (
    <Card className="border-border bg-card/60 shadow-xl mt-6">
      <CardHeader className="border-b border-border/80 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 text-xs font-mono uppercase tracking-wider font-semibold">
            <ShieldCheck className="size-4" /> Union & Guild Compliance Engine
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${preset.badgeColor}`}>
            {preset.name} Active
          </span>
        </div>
        <CardTitle className="text-lg text-foreground">Guild Presets & Labor Protection Rules</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Enforce automated SAG-AFTRA, IATSE, and DGA turnaround rules, meal windows, and overtime safeguards across all stripboards.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        {/* Preset Selection Grid */}
        <div>
          <Label className="text-xs font-semibold text-subtle-foreground uppercase tracking-wider mb-3 block">
            Select Union / Guild Compliance Profile
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(Object.keys(UNION_PRESETS) as UnionPresetKey[]).map((key) => {
              const item = UNION_PRESETS[key]
              const isSelected = selectedPreset === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handlePresetSelect(key)}
                  className={`flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 text-foreground shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                      : 'border-border/90 bg-background/60 text-muted-foreground hover:border-border-strong hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <span className="text-sm font-bold text-foreground">{item.name}</span>
                    {isSelected && (
                      <div className="size-4 rounded-full bg-indigo-500 text-zinc-950 flex items-center justify-center">
                        <Check className="size-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.fullName}
                  </span>
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <span>{item.minTurnaroundHours}h Rest</span>
                    <span>•</span>
                    <span>{item.maxShootingHours}h Max</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Preset Details Banner */}
        <div className="p-4 rounded-xl bg-background border border-border/90 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Award className="size-4 text-amber-700 dark:text-amber-400" />
            <span>{preset.fullName}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{preset.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-border text-xs text-subtle-foreground">
            {preset.rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rule Adjusters / Fine-tuning */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-subtle-foreground uppercase tracking-wider">
            <SlidersHorizontal className="size-3.5 text-indigo-700 dark:text-indigo-400" /> Fine-Tune Threshold Parameters
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2 p-3 rounded-lg bg-background border border-border">
              <Label htmlFor="turnaround-input" className="text-xs font-medium text-subtle-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-indigo-700 dark:text-indigo-400" /> Min Turnaround
                </span>
                <span className="text-indigo-700 dark:text-indigo-400 font-mono font-bold">{minTurnaround}h</span>
              </Label>
              <Input
                id="turnaround-input"
                type="number"
                min={8}
                max={18}
                value={minTurnaround}
                onChange={(e) => {
                  setMinTurnaround(Number(e.target.value))
                  setSelectedPreset('CUSTOM')
                }}
                className="bg-card border-border text-foreground h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Hours of rest required between wrap & call.</p>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-background border border-border">
              <Label htmlFor="maxhours-input" className="text-xs font-medium text-subtle-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Zap className="size-3.5 text-amber-700 dark:text-amber-400" /> Daily Shoot Cap
                </span>
                <span className="text-amber-700 dark:text-amber-400 font-mono font-bold">{maxHours}h</span>
              </Label>
              <Input
                id="maxhours-input"
                type="number"
                min={6}
                max={16}
                value={maxHours}
                onChange={(e) => {
                  setMaxHours(Number(e.target.value))
                  setSelectedPreset('CUSTOM')
                }}
                className="bg-card border-border text-foreground h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Maximum daily shooting hours before overtime.</p>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-background border border-border">
              <Label htmlFor="meal-input" className="text-xs font-medium text-subtle-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Utensils className="size-3.5 text-emerald-700 dark:text-emerald-400" /> Meal Window
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{mealInterval}h</span>
              </Label>
              <Input
                id="meal-input"
                type="number"
                min={4}
                max={8}
                value={mealInterval}
                onChange={(e) => {
                  setMealInterval(Number(e.target.value))
                  setSelectedPreset('CUSTOM')
                }}
                className="bg-card border-border text-foreground h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Max continuous hours before mandatory meal break.</p>
            </div>

            <div className="space-y-2 p-3 rounded-lg bg-background border border-border">
              <Label htmlFor="days-input" className="text-xs font-medium text-subtle-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-purple-700 dark:text-purple-400" /> Work Limit
                </span>
                <span className="text-purple-700 dark:text-purple-400 font-mono font-bold">{maxWorkDays} Days</span>
              </Label>
              <Input
                id="days-input"
                type="number"
                min={5}
                max={7}
                value={maxWorkDays}
                onChange={(e) => {
                  setMaxWorkDays(Number(e.target.value))
                  setSelectedPreset('CUSTOM')
                }}
                className="bg-card border-border text-foreground h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Max consecutive shoot days before mandatory rest day.</p>
            </div>
          </div>
        </div>

        {/* Compliance Preview Card */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-background to-background border border-indigo-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-700 dark:text-emerald-400" />
              <span className="text-sm font-semibold text-foreground">Active Compliance Audit Active</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Stripboard automated engine will flag rest period breaches &lt; {minTurnaround}h and daily call extensions &gt; {maxHours}h.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 h-9 shrink-0 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="size-3.5 mr-1.5 text-emerald-700 dark:text-emerald-300" />
                Rules Applied!
              </>
            ) : (
              'Apply Guild Rules'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
