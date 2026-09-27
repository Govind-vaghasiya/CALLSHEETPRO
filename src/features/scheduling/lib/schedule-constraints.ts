import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { loadAvailabilityWindows } from '@/features/availability/lib/windows'
import { DEFAULT_TIMELINE_SETTINGS } from './day-timeline'
import { parseShootAfterTag, type SceneNeed, type ScheduleConstraints } from './availability-conflicts'

/**
 * Everything the time-aware checks need, loaded once per board refresh:
 * availability windows, what each scene needs (actor via character, location, props…),
 * AD-set call/wrap per booking, location access hours, and timing settings.
 */
export async function loadScheduleConstraints(
  sb: SupabaseClient<Database>,
  projectId: string,
  sceneIds: string[],
  dayIds: string[]
): Promise<ScheduleConstraints> {
  const [windows, { data: settings }, { data: bookings }] = await Promise.all([
    loadAvailabilityWindows(sb, projectId),
    sb.from('project_settings').select('company_move_threshold, currency').eq('project_id', projectId).maybeSingle(),
    dayIds.length
      ? sb.from('resource_bookings').select('shoot_day_id, resource_id, call_time, wrap_time').eq('project_id', projectId)
      : Promise.resolve({ data: [] as Array<{ shoot_day_id: string; resource_id: string; call_time: string | null; wrap_time: string | null }> }),
  ])

  const needsByScene = new Map<string, SceneNeed[]>()
  const locationIds = new Set<string>()
  const neededIds = new Set<string>()
  const shootAfter = new Map<string, string[]>()
  for (let i = 0; i < sceneIds.length; i += 150) {
    const ids = sceneIds.slice(i, i + 150)
    const { data: reqs } = await sb
      .from('scene_requirements')
      .select('scene_id, resource_id, resources(name, resource_type), scene_elements(element_type, characters(name))')
      .in('scene_id', ids)
    for (const r of (reqs || []) as unknown as Array<{
      scene_id: string
      resource_id: string
      resources: { name: string; resource_type: string } | null
      scene_elements: { element_type: string; characters: { name: string } | null } | null
    }>) {
      if (!r.resources) continue
      const list = needsByScene.get(r.scene_id) || []
      list.push({
        resourceId: r.resource_id,
        name: r.resources.name,
        type: r.resources.resource_type,
        character: r.scene_elements?.element_type === 'CAST' ? r.scene_elements.characters?.name ?? null : null,
      })
      needsByScene.set(r.scene_id, list)
      if (r.resources.resource_type === 'LOCATION') locationIds.add(r.resource_id)
      neededIds.add(r.resource_id)
    }

    const { data: tags } = await sb.from('scene_tags').select('scene_id, label').in('scene_id', ids).ilike('label', 'shoot after%')
    for (const t of tags || []) {
      const nums = parseShootAfterTag(t.label)
      if (nums.length) shootAfter.set(t.scene_id, [...(shootAfter.get(t.scene_id) || []), ...nums])
    }
  }

  // Cost of one paid day per resource (hold-day savings in suggestions)
  const ids = Array.from(neededIds)
  const dayRates = new Map<string, number>()
  for (let i = 0; i < ids.length; i += 150) {
    const { data: rates } = await sb
      .from('resource_rates')
      .select('resource_id, rate_type, rate_amount')
      .in('resource_id', ids.slice(i, i + 150))
    for (const r of rates || []) {
      const amount = Number(r.rate_amount || 0)
      const perDay =
        r.rate_type === 'DAILY' ? amount : r.rate_type === 'WEEKLY' ? amount / 5 : r.rate_type === 'HOURLY' ? amount * 10 : 0
      if (perDay > 0) dayRates.set(r.resource_id, perDay)
    }
  }

  const { data: locDetails } = locationIds.size
    ? await sb
        .from('location_details')
        .select('resource_id, access_hours_start, access_hours_end')
        .in('resource_id', Array.from(locationIds))
    : { data: [] }

  return {
    windows,
    needsByScene,
    bookingTimes: new Map(
      (bookings || []).map((b) => [`${b.shoot_day_id}:${b.resource_id}`, { call: b.call_time, wrap: b.wrap_time }])
    ),
    locationHours: new Map(
      (locDetails || []).map((l) => [l.resource_id, { start: l.access_hours_start, end: l.access_hours_end }])
    ),
    shootAfter,
    dayRates,
    currency: settings?.currency || 'USD',
    settings: {
      ...DEFAULT_TIMELINE_SETTINGS,
      companyMoveMinutes: Number(settings?.company_move_threshold ?? DEFAULT_TIMELINE_SETTINGS.companyMoveMinutes),
    },
  }
}
