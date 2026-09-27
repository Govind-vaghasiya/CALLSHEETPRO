'use client'

import React, { useState } from 'react'
import { AnalyticsDashboardCard } from './analytics-dashboard-card'
import { GuestShareModal } from './guest-share-modal'
import type { ProductionMetrics, DailyPacingData } from '../types'

interface ProjectAnalyticsSectionProps {
  projectId: string
  projectName?: string
  metrics: ProductionMetrics
  pacingHistory?: DailyPacingData[]
}

export function ProjectAnalyticsSection({
  projectId,
  projectName = 'Production',
  metrics,
  pacingHistory = [],
}: ProjectAnalyticsSectionProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  return (
    <div className="space-y-4">
      <AnalyticsDashboardCard
        metrics={metrics}
        pacingHistory={pacingHistory}
        onOpenGuestShare={() => setIsShareModalOpen(true)}
      />

      <GuestShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
      />
    </div>
  )
}
