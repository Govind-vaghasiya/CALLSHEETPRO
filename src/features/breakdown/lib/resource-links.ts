/**
 * Single source of truth between Breakdown and Cast & Crew.
 *
 * A confirmed breakdown element (scene_elements) that represents something bookable is linked to
 * exactly one Cast & Crew entry (resources) through scene_requirements. Everything downstream —
 * shoot-day bookings, call sheets, DOOD, availability impact — reads those links, never names.
 *
 * Works with any Supabase client (browser, server, or admin) so both feature modules share it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { linkCastElement, migrateLegacyCast, assignCastNumbers } from '@/features/characters/lib/characters'
import { forEachLimit } from '@/lib/async'
import type {
  Database,
  ElementConfirmStatus,
  ResourceType,
  SceneElementType,
} from '@/types/database'

type Client = SupabaseClient<Database>
type ResourceRow = Database['public']['Tables']['resources']['Row']
type ElementRow = Database['public']['Tables']['scene_elements']['Row']

/**
 * Breakdown categories that are real, bookable Cast & Crew entries.
 * CAST is special: it links to a *character*, and the character's actor is the person booked
 * (see features/characters/lib/characters.ts).
 */
export const LINKED_RESOURCE_TYPE: Partial<Record<SceneElementType, ResourceType>> = {
  CAST: 'PERSON',
  EXTRA: 'PERSON',
  STUNT: 'PERSON',
  LOCATION: 'LOCATION',
  PROP: 'PROP',
  VEHICLE: 'VEHICLE',
  ANIMAL: 'ANIMAL',
  EQUIPMENT: 'EQUIPMENT',
}

/** Placeholder actor name for a character that has not been cast yet. */
export const UNCAST_ACTOR_NAME = 'TBC'

export function isConfirmedStatus(status: ElementConfirmStatus) {
  return status === 'CONFIRMED' || status === 'EDITED'
}

const norm = (s: string | null | undefined) => (s || '').trim().toUpperCase()

/**
 * The name a resource carries inside a breakdown.
 * People are tagged by character (display_name holds the character); everything else by name.
 */
export function breakdownLabel(resource: Pick<ResourceRow, 'resource_type' | 'name' | 'display_name'>) {
  if (resource.resource_type === 'PERSON') return norm(resource.display_name || resource.name)
  return norm(resource.name)
}

function matchesLabel(resource: ResourceRow, label: string) {
  const target = norm(label)
  if (!target) return false
  if (resource.resource_type === 'PERSON') {
    return norm(resource.display_name) === target || norm(resource.name) === target
  }
  return norm(resource.name) === target || norm(resource.display_name) === target
}

/** Existing Cast & Crew entries a breakdown category can link to (for pickers). */
export async function getLinkableResources(sb: Client, projectId: string, elementType: SceneElementType) {
  const resourceType = LINKED_RESOURCE_TYPE[elementType]
  if (!resourceType) return []
  const { data } = await sb
    .from('resources')
    .select('*')
    .eq('project_id', projectId)
    .eq('resource_type', resourceType)
    .eq('is_active', true)
    .order('name', { ascending: true })
  return data || []
}

/** Find the Cast & Crew entry for a breakdown label, creating it when none exists. */
export async function findOrCreateResource(
  sb: Client,
  projectId: string,
  elementType: SceneElementType,
  label: string,
  cache?: ResourceRow[]
): Promise<ResourceRow | null> {
  const resourceType = LINKED_RESOURCE_TYPE[elementType]
  if (!resourceType || !norm(label)) return null

  const pool =
    cache?.filter((r) => r.resource_type === resourceType) ??
    (await getLinkableResources(sb, projectId, elementType))
  const existing = pool.find((r) => matchesLabel(r, label))
  if (existing) return existing

  const {
    data: { user },
  } = await sb.auth.getUser()

  const insert =
    resourceType === 'PERSON'
      ? { name: UNCAST_ACTOR_NAME, display_name: norm(label) }
      : { name: norm(label), display_name: null }

  const { data: created } = await sb
    .from('resources')
    .insert({
      project_id: projectId,
      resource_type: resourceType,
      ...insert,
      notes: elementType === 'EXTRA' ? 'Background / extra' : elementType === 'STUNT' ? 'Stunt performer' : null,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single()

  if (created) cache?.push(created)
  return created ?? null
}

/** Point an element at a resource (replacing any previous link for that element). */
export async function linkElementToResource(sb: Client, element: Pick<ElementRow, 'id' | 'scene_id'>, resourceId: string) {
  await sb.from('scene_requirements').delete().eq('element_id', element.id).neq('resource_id', resourceId)
  await sb
    .from('scene_requirements')
    .upsert(
      { scene_id: element.scene_id, resource_id: resourceId, element_id: element.id, required: true },
      { onConflict: 'scene_id,resource_id' }
    )
}

export async function unlinkElement(sb: Client, elementId: string) {
  await sb.from('scene_requirements').delete().eq('element_id', elementId)
}

/**
 * Bring one element's link in line with its state: confirmed + linkable → linked
 * (to `resourceId` when the user picked one, otherwise found/created by name); anything else → unlinked.
 * The element's name is then rewritten from the resource so both screens show the same text.
 */
export async function reconcileElementLink(
  sb: Client,
  projectId: string,
  element: ElementRow,
  resourceId?: string,
  cache?: ResourceRow[]
): Promise<ResourceRow | null> {
  if (!LINKED_RESOURCE_TYPE[element.element_type] || !isConfirmedStatus(element.confirm_status)) {
    await unlinkElement(sb, element.id)
    return null
  }

  // Cast goes through the character; the actor (if cast) becomes the scene requirement
  if (element.element_type === 'CAST') {
    const character = await linkCastElement(sb, projectId, element)
    if (!character?.actor_resource_id) return null
    const { data: actor } = await sb.from('resources').select('*').eq('id', character.actor_resource_id).single()
    return actor
  }

  let resource: ResourceRow | null = null
  if (resourceId) {
    const { data } = await sb.from('resources').select('*').eq('id', resourceId).single()
    resource = data
  }
  if (!resource) resource = await findOrCreateResource(sb, projectId, element.element_type, element.name, cache)
  if (!resource) return null

  await linkElementToResource(sb, element, resource.id)
  const label = breakdownLabel(resource)
  if (label && label !== element.name) {
    await sb.from('scene_elements').update({ name: label, updated_at: new Date().toISOString() }).eq('id', element.id)
  }
  return resource
}

/** After a resource is renamed in Cast & Crew, rewrite every linked breakdown element. */
export async function propagateResourceLabel(sb: Client, resourceId: string) {
  const { data: resource } = await sb.from('resources').select('*').eq('id', resourceId).single()
  if (!resource) return
  const { data: links } = await sb.from('scene_requirements').select('element_id').eq('resource_id', resourceId)
  const elementIds = (links || []).map((l) => l.element_id).filter((id): id is string => !!id)
  if (elementIds.length === 0) return
  // Cast items are named after their character, not the actor
  await sb
    .from('scene_elements')
    .update({ name: breakdownLabel(resource), updated_at: new Date().toISOString() })
    .in('id', elementIds)
    .neq('element_type', 'CAST')
}

/** Scenes/elements a resource appears in (for Cast & Crew detail and delete warnings). */
export async function getResourceSceneUsage(sb: Client, resourceId: string) {
  const { data } = await sb
    .from('scene_requirements')
    .select('scene_id, element_id, scenes(id, scene_number, heading)')
    .eq('resource_id', resourceId)
  return (data || [])
    .map((r) => r.scenes as unknown as { id: string; scene_number: string; heading: string | null } | null)
    .filter((s): s is { id: string; scene_number: string; heading: string | null } => !!s)
}

/**
 * Idempotent project-wide reconciliation. Safe to run on every Breakdown load:
 *  - every scene with a slugline location gets a LOCATION element,
 *  - every confirmed linkable element is linked to a Cast & Crew entry,
 *  - links on unconfirmed/removed elements are dropped,
 *  - shoot-day bookings are rebuilt from the links.
 */
export async function syncProjectLinks(sb: Client, projectId: string) {
  const { data: scenes } = await sb.from('scenes').select('id, location_name').eq('project_id', projectId)
  const sceneIds = (scenes || []).map((s) => s.id)
  if (sceneIds.length === 0) return

  // Upgrade old "actor + character in one entry" cast data to characters (no-op once done)
  await migrateLegacyCast(sb, projectId)

  const [{ data: elements }, { data: requirements }, { data: resources }] = await Promise.all([
    sb.from('scene_elements').select('*').in('scene_id', sceneIds),
    sb.from('scene_requirements').select('id, element_id, resource_id').in('scene_id', sceneIds),
    sb.from('resources').select('*').eq('project_id', projectId).eq('is_active', true),
  ])

  const allElements = [...(elements || [])]
  const cache = [...(resources || [])]

  // 1. Slugline locations become LOCATION elements (deterministic, so confirmed)
  const scenesWithLocationElement = new Set(
    allElements.filter((e) => e.element_type === 'LOCATION').map((e) => e.scene_id)
  )
  const missingLocations = (scenes || [])
    .filter((s) => norm(s.location_name) && !scenesWithLocationElement.has(s.id))
    .map((s) => ({
      scene_id: s.id,
      element_type: 'LOCATION' as const,
      name: norm(s.location_name),
      confirm_status: 'CONFIRMED' as const,
      ai_confidence: 100,
    }))
  if (missingLocations.length > 0) {
    const { data: inserted } = await sb.from('scene_elements').insert(missingLocations).select('*')
    allElements.push(...(inserted || []))
  }

  // 2. Link / unlink. A fresh script yields hundreds of these, too many to run one by one
  //    inside a serverless time limit. Elements sharing a name stay in one sequential chain so
  //    the first creates the character/resource and the rest reuse it; chains run concurrently.
  const linkedElementIds = new Set((requirements || []).map((r) => r.element_id).filter(Boolean))
  const chains = new Map<string, ElementRow[]>()
  for (const el of allElements) {
    const shouldLink = !!LINKED_RESOURCE_TYPE[el.element_type] && isConfirmedStatus(el.confirm_status)
    // Cast is linked when it has a character; the actor requirement follows the casting
    const needsWork =
      shouldLink && el.element_type === 'CAST'
        ? !el.character_id
        : shouldLink !== linkedElementIds.has(el.id)
    if (!needsWork) continue
    const key = `${LINKED_RESOURCE_TYPE[el.element_type] ?? el.element_type}:${norm(el.name)}`
    chains.set(key, [...(chains.get(key) || []), el])
  }
  await forEachLimit(Array.from(chains.values()), 8, async (chain) => {
    for (const el of chain) {
      if (LINKED_RESOURCE_TYPE[el.element_type] && isConfirmedStatus(el.confirm_status)) {
        await reconcileElementLink(sb, projectId, el, undefined, cache)
      } else {
        await unlinkElement(sb, el.id)
      }
    }
  })

  await assignCastNumbers(sb, projectId)
  await syncProjectBookings(sb, projectId)
}

/**
 * Rebuild resource_bookings (who/what is needed on each shoot day) from the scene links.
 * Existing bookings keep their call/wrap times; only additions and removals are applied.
 * Also fills each day's primary location from its scenes when it is unset or stale.
 */
export async function syncProjectBookings(sb: Client, projectId: string) {
  const { data: days } = await sb
    .from('shoot_days')
    .select('id, primary_location_id')
    .eq('project_id', projectId)
  const dayIds = (days || []).map((d) => d.id)

  const { data: existing } = await sb
    .from('resource_bookings')
    .select('id, shoot_day_id, resource_id')
    .eq('project_id', projectId)

  const desired = new Map<string, { shoot_day_id: string; resource_id: string }>()
  const locationsByDay = new Map<string, Map<string, number>>()

  if (dayIds.length > 0) {
    const { data: dayScenes } = await sb
      .from('shoot_day_scenes')
      .select('shoot_day_id, scene_id')
      .in('shoot_day_id', dayIds)
    const sceneIds = Array.from(new Set((dayScenes || []).map((d) => d.scene_id)))

    if (sceneIds.length > 0) {
      const { data: reqs } = await sb
        .from('scene_requirements')
        .select('scene_id, resource_id, resources(resource_type)')
        .in('scene_id', sceneIds)

      for (const ds of dayScenes || []) {
        for (const r of (reqs || []).filter((q) => q.scene_id === ds.scene_id)) {
          desired.set(`${ds.shoot_day_id}:${r.resource_id}`, { shoot_day_id: ds.shoot_day_id, resource_id: r.resource_id })
          const type = (r.resources as unknown as { resource_type: ResourceType } | null)?.resource_type
          if (type === 'LOCATION') {
            const counts = locationsByDay.get(ds.shoot_day_id) || new Map<string, number>()
            counts.set(r.resource_id, (counts.get(r.resource_id) || 0) + 1)
            locationsByDay.set(ds.shoot_day_id, counts)
          }
        }
      }
    }
  }

  const existingKeys = new Set((existing || []).map((b) => `${b.shoot_day_id}:${b.resource_id}`))
  const toDelete = (existing || []).filter((b) => !desired.has(`${b.shoot_day_id}:${b.resource_id}`)).map((b) => b.id)
  const toInsert = Array.from(desired.entries())
    .filter(([key]) => !existingKeys.has(key))
    .map(([, v]) => ({ project_id: projectId, ...v }))

  if (toDelete.length > 0) await sb.from('resource_bookings').delete().in('id', toDelete)
  if (toInsert.length > 0) await sb.from('resource_bookings').insert(toInsert)

  // Primary location = the location used by most scenes that day
  for (const day of days || []) {
    const counts = locationsByDay.get(day.id)
    if (!counts || counts.size === 0) continue
    if (day.primary_location_id && counts.has(day.primary_location_id)) continue
    const [top] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
    await sb.from('shoot_days').update({ primary_location_id: top[0] }).eq('id', day.id)
  }
}
