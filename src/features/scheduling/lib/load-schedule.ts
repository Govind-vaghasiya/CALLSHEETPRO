import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { ProjectScheduleData, ShootDayWithScenes } from '../actions'

type SceneRow = Database['public']['Tables']['scenes']['Row']

/**
 * The project's schedule (days with ordered scenes + the unscheduled pool), for any Supabase
 * client. Mirrors getProjectScheduleAction so server code sees exactly what the stripboard shows.
 */
export async function loadSchedule(sb: SupabaseClient<Database>, projectId: string): Promise<ProjectScheduleData> {
  const [{ data: days }, { data: allScenes }] = await Promise.all([
    sb.from('shoot_days').select('*').eq('project_id', projectId).order('day_number', { ascending: true }),
    sb.from('scenes').select('*').eq('project_id', projectId).order('scene_order', { ascending: true }),
  ])

  const dayIds = (days || []).map((d) => d.id)
  type Placement = {
    id: string
    shoot_day_id: string
    sort_order: number
    estimated_minutes: number | null
    fixed_start_time?: string | null
    scenes: unknown
  }
  let placements: Placement[] = []
  if (dayIds.length) {
    // fixed_start_time needs migration 021; fall back until it has been run
    const withFixed = await sb
      .from('shoot_day_scenes')
      .select('id, shoot_day_id, scene_id, sort_order, estimated_minutes, fixed_start_time, scenes(*)')
      .in('shoot_day_id', dayIds)
      .order('sort_order', { ascending: true })
    placements = (withFixed.error
      ? (
          await sb
            .from('shoot_day_scenes')
            .select('id, shoot_day_id, scene_id, sort_order, estimated_minutes, scenes(*)')
            .in('shoot_day_id', dayIds)
            .order('sort_order', { ascending: true })
        ).data
      : withFixed.data) as Placement[] | null || []
  }

  const placed = new Set<string>()
  const shootDays: ShootDayWithScenes[] = (days || []).map((day) => {
    const scenes = placements
      .filter((p) => p.shoot_day_id === day.id && p.scenes)
      .map((p) => {
        const scene = p.scenes as unknown as SceneRow
        placed.add(scene.id)
        return {
          assignmentId: p.id,
          scene,
          sortOrder: p.sort_order,
          estimatedMinutes: p.estimated_minutes || scene.estimated_duration || 30,
          fixedStartTime: p.fixed_start_time ?? null,
        }
      })
    return {
      ...day,
      scenes,
      totalEstimatedMinutes: scenes.reduce((m, s) => m + (s.estimatedMinutes || 30), 0),
    }
  })

  return {
    shootDays,
    unscheduledScenes: (allScenes || []).filter((s) => !placed.has(s.id)),
  }
}
