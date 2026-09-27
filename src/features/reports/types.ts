import { ResourceType } from '@/types/database'

export type DoodStatusCode = 'SW' | 'W' | 'WF' | 'SWF' | 'H' | 'T' | 'WD' | null

export interface DoodStatusInfo {
  code: DoodStatusCode
  label: string
  color: string
}

export interface DoodResourceRow {
  resource_id: string
  resource_name: string
  character_name: string | null
  id_number?: number
  resource_type: ResourceType
  daily_statuses: Record<string, DoodStatusCode> // Keyed by shoot_day_id or shoot_date
  total_work_days: number
  total_hold_days: number
  total_travel_days: number
}

export interface DoodReportData {
  project_id: string
  project_name: string
  shoot_days: Array<{
    id: string
    day_number: number
    shoot_date: string
  }>
  cast_rows: DoodResourceRow[]
  equipment_rows: DoodResourceRow[]
  location_rows: DoodResourceRow[]
}
