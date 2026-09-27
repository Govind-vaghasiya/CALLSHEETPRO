import { AvailabilityStatus, ResourceType } from '@/types/database'

export interface ResourceAvailabilityWindow {
  id: string
  resource_id: string
  resource_name: string
  resource_type: ResourceType
  start_date: string // YYYY-MM-DD (production time zone)
  end_date: string // YYYY-MM-DD (production time zone)
  /** false = specific hours (start_time on start_date → end_time on end_date) */
  all_day: boolean
  start_time: string | null // HH:MM local, when !all_day
  end_time: string | null // HH:MM local, when !all_day
  status: AvailabilityStatus
  notes: string | null
  created_at: string
}

export interface ResourceBookingInfo {
  shoot_day_id: string
  day_number: number
  shoot_date: string
  scene_id?: string
  scene_number?: string
}

export interface ResourceAvailabilityRow {
  resource_id: string
  resource_name: string
  display_name: string | null
  resource_type: ResourceType
  department_name?: string
  availability_windows: ResourceAvailabilityWindow[]
  bookings: ResourceBookingInfo[]
}

export interface AvailabilityGridData {
  project_id: string
  project_name: string
  start_date: string | null
  target_end_date: string | null
  dates: string[] // Array of YYYY-MM-DD dates in schedule
  shoot_days: Array<{
    id: string
    day_number: number
    shoot_date: string
    is_locked: boolean
  }>
  resources: ResourceAvailabilityRow[]
}

export interface AvailabilityImpactReport {
  resourceId: string
  resourceName: string
  resourceType: ResourceType
  blackoutStatus: AvailabilityStatus
  startDate: string
  endDate: string
  /** e.g. "3:00 PM–5:00 PM", or null for all day */
  timeLabel: string | null
  affectedShootDays: Array<{
    dayId: string
    dayNumber: number
    shootDate: string
  }>
  affectedScenes: Array<{
    sceneId: string
    sceneNumber: string
    heading: string
    locationName: string
    /** "Day 9 · 1:30 PM–3:00 PM" */
    plannedSlot?: string
  }>
  /** Days they are on call but only unavailable between their scenes */
  onCallWarnings: string[]
  totalPagesImpacted: number
  suggestedResolutions: Array<{
    id: string
    label: string
    actionType: 'SWAP_DAYS' | 'REPLACE_RESOURCE' | 'UNASSIGN_SCENES'
  }>
}
