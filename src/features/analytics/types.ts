export interface ProductionMetrics {
  totalScriptPages: number
  pagesShotCompleted: number
  pagesRemaining: number
  completionPercentage: number
  /** null until at least one shoot day is marked COMPLETED */
  avgPagesPerDay: number | null
  /** pages the schedule plans per day (scheduled pages / scheduled days) */
  targetPagesPerDay: number | null
  totalShootDays: number
  shootDaysCompleted: number
  scheduledScenes: number
  totalScenes: number
  /** from Cast & Crew rates + budget line items */
  estimatedBudget: number
  pricedResources: number
  currency: string
}

export interface DailyPacingData {
  dayId: string
  /** scenes on this day, in shooting order */
  scenes: Array<{ id: string; sceneNumber: string; heading: string | null; intExt: string | null; timeOfDay: string | null }>
  shootDay: number
  date: string
  scheduledPages: number
  sceneCount: number
  status: string
}

export type GuestAccessScope = 'VIEW_CALL_SHEETS' | 'VIEW_STRIPBOARD' | 'FULL_READ_ONLY'

export interface ShareableGuestLink {
  id: string
  projectId: string
  token: string
  url: string
  accessScope: GuestAccessScope
  expiresAt: string
  createdAt: string
  visitCount: number
}
