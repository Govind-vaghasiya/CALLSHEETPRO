/**
 * Builds a call sheet purely from production data — no invented names, times, or places.
 * Cast comes from the breakdown links (scene_requirements) of the day's scenes, call times from
 * resource_bookings, hospital from the day's primary location, and the editable extras
 * (weather, meals, notes, publish state) from the call_sheets row for that day.
 *
 * Takes a Supabase client so the signed-in app and the guest viewer share one implementation.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json, CallsheetStatus } from '@/types/database'
import { doodStatusForDay, formatClockTime, addMinutesToClock } from '@/features/reports/lib/dood-status'
import { buildDayTimeline, personWindow, DEFAULT_TIMELINE_SETTINGS } from '@/features/scheduling/lib/day-timeline'
import { minutesToLabel } from '@/features/scheduling/lib/time'
import type { DoodStatusCode } from '@/features/reports/types'

type Client = SupabaseClient<Database>
type SceneRow = Database['public']['Tables']['scenes']['Row']

export const NOT_SET = '—'

export interface CallSheetSceneItem {
  assignmentId: string
  scene: SceneRow
  sortOrder: number
  /** Cast ID numbers (as on the cast list) appearing in this scene */
  castIds: string[]
}

export interface CallSheetCastMember {
  id: string
  castId: string
  characterName: string
  actorName: string
  status: Exclude<DoodStatusCode, null>
  pickupTime: string
  hmuCallTime: string
  onSetCallTime: string
  notes?: string
}

/** Editable call-sheet extras, stored on the call_sheets row (meals/unit live in branding_header). */
export interface CallSheetDetails {
  weather: { temp: string; condition: string; sunrise: string; sunset: string }
  breakfast: string
  lunch: string
  unitName: string
  specialInstructions: string
  hospitalName: string
  hospitalKm: number | null
}

export interface CallSheetRecord {
  id: string | null
  status: CallsheetStatus
  version: number
  publishedAt: string | null
}

export interface CallSheetFullData {
  project: Database['public']['Tables']['projects']['Row']
  shootDays: Database['public']['Tables']['shoot_days']['Row'][]
  currentDay: Database['public']['Tables']['shoot_days']['Row']
  scenes: CallSheetSceneItem[]
  castMembers: CallSheetCastMember[]
  location: { name: string; address: string } | null
  hospitalInfo: { name: string; address: string; phone: string; distance: string }
  weatherInfo: { temp: string; condition: string; sunrise: string; sunset: string }
  keyContacts: {
    director: string
    producer: string
    firstAD: string
    crewCall: string
    breakfast: string
    lunch: string
    wrap: string
  }
  unitName: string
  record: CallSheetRecord
  details: CallSheetDetails
}

const asObject = (value: Json | null | undefined): Record<string, Json | undefined> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Json | undefined>) : {}
const str = (value: Json | undefined) => (typeof value === 'string' ? value : '')

export async function buildCallSheet(
  sb: Client,
  projectId: string,
  targetDayId?: string
): Promise<CallSheetFullData | null> {
  const { data: project } = await sb.from('projects').select('*').eq('id', projectId).single()
  if (!project) return null

  const { data: days } = await sb
    .from('shoot_days')
    .select('*')
    .eq('project_id', projectId)
    .order('day_number', { ascending: true })
  if (!days || days.length === 0) return null

  const currentDay = (targetDayId && days.find((d) => d.id === targetDayId)) || days[0]
  const dayIndex = days.findIndex((d) => d.id === currentDay.id)
  const dayIds = days.map((d) => d.id)

  const [{ data: dayAssignments }, { data: bookings }, { data: sheetRows }, { data: org }] = await Promise.all([
    sb
      .from('shoot_day_scenes')
      .select('id, scene_id, sort_order, estimated_minutes, scenes(*)')
      .eq('shoot_day_id', currentDay.id)
      .order('sort_order', { ascending: true }),
    sb.from('resource_bookings').select('shoot_day_id, resource_id, call_time, notes').in('shoot_day_id', dayIds),
    sb
      .from('call_sheets')
      .select('*')
      .eq('shoot_day_id', currentDay.id)
      .order('version', { ascending: false })
      .limit(1),
    sb.from('organizations').select('name').eq('id', project.organization_id).maybeSingle(),
  ])

  // Running order for the day (same estimate the stripboard shows)
  const { data: timingSettings } = await sb
    .from('project_settings')
    .select('company_move_threshold')
    .eq('project_id', projectId)
    .maybeSingle()
  const timeline = buildDayTimeline(
    currentDay.call_time,
    currentDay.wrap_time,
    (dayAssignments || [])
      .filter((a) => a.scenes)
      .map((a) => {
        const sc = a.scenes as unknown as SceneRow
        return { sceneId: sc.id, minutes: a.estimated_minutes || sc.estimated_duration || 30, location: sc.location_name }
      }),
    {
      ...DEFAULT_TIMELINE_SETTINGS,
      companyMoveMinutes: Number(timingSettings?.company_move_threshold ?? DEFAULT_TIMELINE_SETTINGS.companyMoveMinutes),
    }
  )

  const scenesList: CallSheetSceneItem[] = (dayAssignments || [])
    .filter((a) => a.scenes)
    .map((a) => ({
      assignmentId: a.id,
      scene: a.scenes as unknown as SceneRow,
      sortOrder: a.sort_order,
      castIds: [],
    }))

  // ---- Cast: characters in today's scenes, numbered by their cast number, with who plays them ----
  const todaysSceneIds = scenesList.map((s) => s.scene.id)
  const { data: castItems } = todaysSceneIds.length
    ? await sb
        .from('scene_elements')
        .select('scene_id, character_id, characters(id, name, cast_number, actor_resource_id)')
        .in('scene_id', todaysSceneIds)
        .eq('element_type', 'CAST')
        .not('character_id', 'is', null)
    : { data: [] }

  type CastItem = {
    scene_id: string
    characters: { id: string; name: string; cast_number: number | null; actor_resource_id: string | null } | null
  }
  const items = ((castItems || []) as unknown as CastItem[]).filter((i) => i.characters)
  const characters = new Map(items.map((i) => [i.characters!.id, i.characters!]))

  for (const item of scenesList) {
    item.castIds = Array.from(
      new Set(
        items
          .filter((i) => i.scene_id === item.scene.id)
          .map((i) => String(i.characters!.cast_number ?? '—'))
      )
    ).sort((a, b) => Number(a) - Number(b))
  }

  const actorIds = Array.from(characters.values())
    .map((c) => c.actor_resource_id)
    .filter((id): id is string => !!id)
  const { data: actors } = actorIds.length
    ? await sb.from('resources').select('id, name, notes').in('id', actorIds)
    : { data: [] }
  const actorById = new Map((actors || []).map((a) => [a.id, a]))

  const workedIndicesFor = (resourceId: string) =>
    days
      .map((d, i) => ((bookings || []).some((b) => b.shoot_day_id === d.id && b.resource_id === resourceId) ? i : -1))
      .filter((i) => i >= 0)

  const generalCall = formatClockTime(currentDay.call_time) || NOT_SET
  const castMembers: CallSheetCastMember[] = Array.from(characters.values())
    .sort((a, b) => (a.cast_number ?? Infinity) - (b.cast_number ?? Infinity) || a.name.localeCompare(b.name))
    .map((c) => {
      const actor = c.actor_resource_id ? actorById.get(c.actor_resource_id) : undefined
      const booking = actor
        ? (bookings || []).find((b) => b.shoot_day_id === currentDay.id && b.resource_id === actor.id)
        : undefined
      // Their own call: AD-set booking time, else first scene minus hair/makeup prep
      const window = personWindow(timeline, new Set(items.filter((i) => i.characters!.id === c.id).map((i) => i.scene_id)), {
        prepMinutes: DEFAULT_TIMELINE_SETTINGS.castPrepMinutes,
        bookingCall: booking?.call_time,
      })
      return {
        id: c.id,
        castId: c.cast_number != null ? String(c.cast_number) : '—',
        characterName: c.name,
        actorName: actor?.name || 'Not cast yet',
        status: (actor && doodStatusForDay(workedIndicesFor(actor.id), dayIndex)) || 'W',
        pickupTime: NOT_SET,
        hmuCallTime: actor && window ? minutesToLabel(window.call) : NOT_SET,
        onSetCallTime: actor && window ? minutesToLabel(Math.max(timeline.call, window.call + DEFAULT_TIMELINE_SETTINGS.castPrepMinutes)) : actor ? generalCall : NOT_SET,
        notes: booking?.notes || actor?.notes || undefined,
      }
    })

  // ---- Location & hospital: from the day's primary location in Cast & Crew ----
  let location: CallSheetFullData['location'] = null
  let locationDetails: Database['public']['Tables']['location_details']['Row'] | null = null
  if (currentDay.primary_location_id) {
    const [{ data: loc }, { data: det }] = await Promise.all([
      sb.from('resources').select('name').eq('id', currentDay.primary_location_id).maybeSingle(),
      sb.from('location_details').select('*').eq('resource_id', currentDay.primary_location_id).maybeSingle(),
    ])
    locationDetails = det
    if (loc) {
      const address = det
        ? [det.address_line1, det.address_line2, det.city, det.state_province, det.postal_code]
            .filter(Boolean)
            .join(', ')
        : ''
      location = { name: loc.name, address: address || NOT_SET }
    }
  }

  // ---- Key contacts: from crew roles in Cast & Crew ----
  const { data: roleRows } = await sb
    .from('resource_roles')
    .select('roles(name), resources!inner(name, project_id)')
    .eq('resources.project_id', projectId)
  const personInRole = (roleName: string) =>
    ((roleRows || []) as unknown as Array<{ roles: { name: string } | null; resources: { name: string } | null }>)
      .find((r) => r.roles?.name === roleName)?.resources?.name || NOT_SET

  // ---- Stored call-sheet extras ----
  const sheet = sheetRows?.[0] || null
  const weatherJson = asObject(sheet?.weather_data)
  const extras = asObject(sheet?.branding_header)
  const hospitalName = sheet?.nearest_hospital || locationDetails?.nearest_hospital || ''
  const hospitalKm = sheet?.nearest_hospital_km ?? locationDetails?.nearest_hospital_km ?? null

  const details: CallSheetDetails = {
    weather: {
      temp: str(weatherJson.temp),
      condition: str(weatherJson.condition),
      sunrise: str(weatherJson.sunrise),
      sunset: str(weatherJson.sunset),
    },
    breakfast: str(extras.breakfast),
    lunch: str(extras.lunch),
    unitName: str(extras.unitName),
    specialInstructions: sheet?.special_instructions || '',
    hospitalName,
    hospitalKm,
  }

  // Meal defaults follow the 6-hour meal rule when not set explicitly
  const lunch =
    formatClockTime(details.lunch) ||
    (currentDay.call_time ? `${formatClockTime(addMinutesToClock(currentDay.call_time, 360))} (6h)` : NOT_SET)

  return {
    project,
    shootDays: days,
    currentDay,
    scenes: scenesList,
    castMembers,
    location,
    hospitalInfo: {
      name: hospitalName || 'Not set — add it to the location in Cast & Crew',
      address: NOT_SET,
      phone: NOT_SET,
      distance: hospitalKm != null ? `${hospitalKm} km` : NOT_SET,
    },
    weatherInfo: {
      temp: details.weather.temp || NOT_SET,
      condition: details.weather.condition || 'Not set',
      sunrise: details.weather.sunrise || NOT_SET,
      sunset: details.weather.sunset || NOT_SET,
    },
    keyContacts: {
      director: personInRole('Director'),
      producer: personInRole('Producer'),
      firstAD: personInRole('1st Assistant Director'),
      crewCall: generalCall,
      breakfast: formatClockTime(details.breakfast) || NOT_SET,
      lunch,
      wrap: formatClockTime(currentDay.wrap_time) || NOT_SET,
    },
    unitName: details.unitName || org?.name || '',
    record: {
      id: sheet?.id ?? null,
      status: sheet?.status ?? 'DRAFT',
      version: sheet?.version ?? 1,
      publishedAt: sheet?.published_at ?? null,
    },
    details,
  }
}
