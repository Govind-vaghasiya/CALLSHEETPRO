import type { ProjectScheduleData } from '@/features/scheduling/actions'

export type RevisionColor =
  | 'WHITE'
  | 'BLUE'
  | 'PINK'
  | 'YELLOW'
  | 'GREEN'
  | 'GOLDENROD'
  | 'BUFF'
  | 'SALMON'
  | 'CHERRY'
  | 'TAN'

export interface ScheduleVersionSnapshot {
  id: string
  projectId: string
  versionName: string
  revisionColor: RevisionColor
  notes?: string
  createdAt: string
  snapshotData: ProjectScheduleData
}

export interface MovedSceneDiff {
  sceneId: string
  sceneNumber: string
  heading: string
  fromDayNumber: number | 'Pool'
  toDayNumber: number | 'Pool'
}

export interface TimeShiftDiff {
  dayNumber: number
  oldCallTime: string
  newCallTime: string
}

export interface ScheduleDiffResult {
  addedDayNumbers: number[]
  removedDayNumbers: number[]
  movedScenes: MovedSceneDiff[]
  timeShifts: TimeShiftDiff[]
}
