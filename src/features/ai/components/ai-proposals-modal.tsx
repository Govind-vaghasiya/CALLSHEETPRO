'use client'

import React, { useState, useEffect } from 'react'
import { useFeedback } from '@/components/ui/feedback-provider'
import { useModalBehavior } from '@/components/ui/use-modal-behavior'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, DollarSign, Clock, ShieldCheck, Check, ArrowRight, X, Wand2 } from 'lucide-react'
import type { ScheduleProposalScenario } from '../types'
import { generateScheduleProposalsAction, applyScheduleProposalAction } from '../actions'

interface AiProposalsModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onProposalApplied?: () => void
}

export function AiProposalsModal({
  isOpen,
  onClose,
  projectId,
  onProposalApplied,
}: AiProposalsModalProps) {
  const { confirm, notify } = useFeedback()
  useModalBehavior(isOpen, onClose)
  const [proposals, setProposals] = useState<ScheduleProposalScenario[]>([])
  const [selectedProposal, setSelectedProposal] = useState<ScheduleProposalScenario | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadProposals()
    }
  }, [isOpen, projectId])

  async function loadProposals() {
    setIsLoading(true)
    try {
      const data = await generateScheduleProposalsAction(projectId)
      setProposals(data)
      if (data.length > 0) setSelectedProposal(data[0])
    } catch (err) {
      console.error('Failed to generate proposals:', err)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleApplyProposal() {
    if (!selectedProposal) return
    const ok = await confirm({
      title: `Apply "${selectedProposal.title}"?`,
      message: 'This changes the live schedule. Save a schedule version first if you may want to undo it.',
      confirmLabel: 'Apply',
    })
    if (!ok) return

    setIsApplying(true)
    const res = await applyScheduleProposalAction(projectId, selectedProposal.id)
    setIsApplying(false)

    if (res.error) {
      notify(res.error, 'error')
    } else {
      onProposalApplied?.()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-card/60">
          <div className="flex items-center gap-2">
            <Wand2 className="size-5 text-amber-700 dark:text-amber-400" />
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                AI Schedule Proposals & Optimization Scenarios
              </h3>
              <p className="text-xs text-muted-foreground">
                Compare AI-generated schedule scenarios to save budget, reduce wrap dates, and protect SAG turnaround rules.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <Wand2 className="size-8 text-amber-700 dark:text-amber-400 animate-spin mx-auto" />
              <p className="text-sm text-subtle-foreground font-medium">Generating AI schedule optimization scenarios...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm text-foreground font-medium">No improvements found</p>
              <p className="text-xs text-muted-foreground">
                The schedule has no turnaround violations and scenes are already grouped by location.
              </p>
            </div>
          ) : (
            <>
              {/* Proposal Cards Selector */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {proposals.map((prop) => {
                  const isSelected = selectedProposal?.id === prop.id

                  return (
                    <div
                      key={prop.id}
                      onClick={() => setSelectedProposal(prop)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 relative ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30 shadow-lg'
                          : 'bg-card/60 border-border/80 hover:border-border-strong hover:bg-card'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-mono uppercase ${
                              prop.category === 'COST_SAVING'
                                ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10'
                                : prop.category === 'SPEED_WRAP'
                                ? 'border-sky-500/40 text-sky-700 dark:text-sky-400 bg-sky-500/10'
                                : 'border-purple-500/40 text-purple-700 dark:text-purple-400 bg-purple-500/10'
                            }`}
                          >
                            {prop.category.replace('_', ' ')}
                          </Badge>
                          {isSelected && <Check className="size-4 text-amber-700 dark:text-amber-400" />}
                        </div>

                        <h4 className="font-bold text-sm text-foreground leading-snug">{prop.title}</h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{prop.tagline}</p>
                      </div>

                      {/* Stat Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-center">
                        <div className="bg-background/80 p-2 rounded-lg">
                          <span className="text-[9px] text-muted-foreground uppercase font-mono block">Moves Removed</span>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{prop.companyMovesRemoved}</span>
                        </div>
                        <div className="bg-background/80 p-2 rounded-lg">
                          <span className="text-[9px] text-muted-foreground uppercase font-mono block">Days Saved</span>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{prop.daysSaved > 0 ? `${prop.daysSaved} Days` : 'Same'}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selected Proposal Detail Inspector */}
              {selectedProposal && (
                <div className="bg-card/80 border border-border p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/80 pb-3">
                    <div>
                      <h4 className="text-lg font-bold text-foreground tracking-tight">{selectedProposal.title}</h4>
                      <p className="text-xs text-muted-foreground">{selectedProposal.summary}</p>
                    </div>

                    <Button
                      onClick={handleApplyProposal}
                      disabled={isApplying}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold gap-1.5 shadow-md shadow-amber-950 shrink-0"
                    >
                      <Sparkles className="size-4" />
                      <span>{isApplying ? 'Applying Scenario...' : 'Apply Scenario to Board'}</span>
                    </Button>
                  </div>

                  {/* Summary of Changes */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-subtle-foreground uppercase tracking-wider block">
                      Key Optimization Adjustments
                    </span>
                    <div className="space-y-1.5">
                      {selectedProposal.changes.map((change, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-subtle-foreground">
                          <ArrowRight className="size-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Proposed Shoot Days Preview */}
                  <div className="space-y-2 pt-2">
                    <span className="text-xs font-bold text-subtle-foreground uppercase tracking-wider block">
                      Proposed Shoot Day Layout ({selectedProposal.proposedShootDays.length} Days)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {selectedProposal.proposedShootDays.map((day) => (
                        <div key={day.day_number} className="bg-background border border-border p-3 rounded-xl space-y-1 text-xs">
                          <div className="flex items-center justify-between font-mono font-bold text-amber-700 dark:text-amber-400">
                            <span>SHOOT DAY {day.day_number}</span>
                            <span className="text-muted-foreground font-normal">{day.estimated_hours}h</span>
                          </div>
                          <div className="font-semibold text-foreground truncate">{day.location_summary}</div>
                          <div className="text-[11px] text-muted-foreground">{day.scene_count} Scenes Scheduled</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
