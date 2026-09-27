export interface ScheduleHealthScore {
  overallScore: number // 0 - 100
  turnaroundSafetyScore: number // 0 - 100
  workloadBalanceScore: number // 0 - 100
  locationEfficiencyScore: number // 0 - 100
  castHoldEfficiencyScore: number // 0 - 100
}

export type DiagnosticSeverity = 'CRITICAL' | 'WARNING' | 'TIP'
export type DiagnosticCategory =
  | 'TURNAROUND'
  | 'OVERLOAD'
  | 'LOCATION_MOVE'
  | 'EXCESSIVE_HOLD'
  | 'DAY_NIGHT_FLIP'
  | 'UNSCHEDULED_POOL'

export interface ScheduleDiagnosticIssue {
  id: string
  severity: DiagnosticSeverity
  category: DiagnosticCategory
  title: string
  description: string
  impact: string
  suggestedAction: string
}

export interface ScheduleAnalysisReport {
  projectId: string
  projectName: string
  healthScore: ScheduleHealthScore
  diagnostics: ScheduleDiagnosticIssue[]
  recommendations: string[]
  metricsSummary: {
    totalShootDays: number
    totalScenes: number
    totalPages: string
    avgHoursPerDay: number
    totalLocationMoves: number
  }
}

export type ProposalCategory = 'COST_SAVING' | 'SPEED_WRAP' | 'LOCATION_CLUSTER' | 'BALANCED_TURNAROUND'

export interface ScheduleProposalScenario {
  id: string
  title: string
  tagline: string
  category: ProposalCategory
  daysSaved: number
  companyMovesRemoved: number
  healthScoreImprovement: number
  summary: string
  changes: string[]
  proposedShootDays: Array<{
    day_number: number
    location_summary: string
    scene_count: number
    estimated_hours: number
  }>
}
