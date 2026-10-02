/**
 * Characters vs people.
 *
 *   scene_elements (CAST) ──character_id──▶ characters ──actor_resource_id──▶ resources (PERSON)
 *
 * A breakdown CAST item names a character ("LAKHAN"). The character is cast once
 * ("played by Anil Kapoor"). The actor requirement for each scene is derived from that:
 * scene_requirements(scene, actor, element) exists only while the character is cast, so
 * bookings, availability, DOOD, and call sheets follow the casting automatically.
 *
 * Works with any Supabase client. Callers rebuild bookings (syncProjectBookings) afterwards.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { normalizeCharacterName } from './character-cues'
import { forEachLimit } from '@/lib/async'

type Client = SupabaseClient<Database>
type CharacterRow = Database['public']['Tables']['characters']['Row']
type ElementRow = Database['public']['Tables']['scene_elements']['Row']

/** Placeholder actor name used before characters existed (legacy "TBC" entries). */
const LEGACY_UNCAST = 'TBC'

export async function listCharacters(sb: Client, projectId: string) {
  const { data } = await sb.from('characters').select('*').eq('project_id', projectId).order('cast_number', { ascending: true, nullsFirst: false }).order('name')
  return data || []
}

/** Find a character by name (case-insensitive), creating it when missing. */
export async function findOrCreateCharacter(
  sb: Client,
  projectId: string,
  rawName: string,
  cache?: CharacterRow[]
): Promise<CharacterRow | null> {
  const name = normalizeCharacterName(rawName)
  if (!name) return null
  const pool = cache ?? (await listCharacters(sb, projectId))
  const existing = pool.find((c) => c.name.toUpperCase() === name)
  if (existing) return existing

  const { data: created, error } = await sb.from('characters').insert({ project_id: projectId, name }).select('*').single()
  if (created) {
    cache?.push(created)
    return created
  }
  // Lost a race with another insert (unique name index): read the winner
  if (error?.code === '23505') {
    const { data } = await sb.from('characters').select('*').eq('project_id', projectId).ilike('name', name).maybeSingle()
    if (data) cache?.push(data)
    return data ?? null
  }
  return null
}

/** Make the scene's actor requirement match the character's casting (or remove it). */
async function syncElementRequirement(sb: Client, element: Pick<ElementRow, 'id' | 'scene_id'>, actorId: string | null) {
  if (actorId) {
    await sb.from('scene_requirements').delete().eq('element_id', element.id).neq('resource_id', actorId)
    await sb
      .from('scene_requirements')
      .upsert(
        { scene_id: element.scene_id, resource_id: actorId, element_id: element.id, required: true },
        { onConflict: 'scene_id,resource_id' }
      )
  } else {
    await sb.from('scene_requirements').delete().eq('element_id', element.id)
  }
}

/** Link one CAST breakdown item to its character (found/created by name unless given). */
export async function linkCastElement(
  sb: Client,
  projectId: string,
  element: ElementRow,
  characterId?: string,
  cache?: CharacterRow[]
): Promise<CharacterRow | null> {
  let character: CharacterRow | null = null
  if (characterId) {
    const { data } = await sb.from('characters').select('*').eq('id', characterId).single()
    character = data
  }
  if (!character) character = await findOrCreateCharacter(sb, projectId, element.name, cache)
  if (!character) return null

  if (element.character_id !== character.id || element.name !== character.name) {
    await sb
      .from('scene_elements')
      .update({ character_id: character.id, name: character.name, updated_at: new Date().toISOString() })
      .eq('id', element.id)
  }
  await syncElementRequirement(sb, element, character.actor_resource_id)
  return character
}

/** Re-derive every scene requirement for a character after casting changes. */
export async function syncCharacterRequirements(sb: Client, characterId: string) {
  const { data: character } = await sb.from('characters').select('*').eq('id', characterId).single()
  if (!character) return
  const { data: elements } = await sb.from('scene_elements').select('id, scene_id').eq('character_id', characterId)
  for (const el of elements || []) await syncElementRequirement(sb, el, character.actor_resource_id)
}

/** Cast (or uncast with null) a character. */
export async function castCharacter(sb: Client, characterId: string, actorResourceId: string | null) {
  await sb
    .from('characters')
    .update({ actor_resource_id: actorResourceId, updated_at: new Date().toISOString() })
    .eq('id', characterId)
  await syncCharacterRequirements(sb, characterId)
}

/** Rename a character everywhere; if the new name already exists, merge into that character. */
export async function renameCharacter(sb: Client, characterId: string, rawName: string) {
  const name = normalizeCharacterName(rawName)
  const { data: character } = await sb.from('characters').select('*').eq('id', characterId).single()
  if (!character || !name) return { error: 'Character not found' }

  const { data: clash } = await sb
    .from('characters')
    .select('*')
    .eq('project_id', character.project_id)
    .ilike('name', name)
    .neq('id', characterId)
    .maybeSingle()
  if (clash) {
    await mergeCharacters(sb, characterId, clash.id)
    return { mergedInto: clash.id }
  }
  await sb.from('characters').update({ name, updated_at: new Date().toISOString() }).eq('id', characterId)
  await sb.from('scene_elements').update({ name, updated_at: new Date().toISOString() }).eq('character_id', characterId)
  return {}
}

/** Move all of `fromId`'s scenes onto `intoId`, then delete `fromId`. Keeps the target's casting. */
export async function mergeCharacters(sb: Client, fromId: string, intoId: string) {
  const [{ data: from }, { data: into }] = await Promise.all([
    sb.from('characters').select('*').eq('id', fromId).single(),
    sb.from('characters').select('*').eq('id', intoId).single(),
  ])
  if (!from || !into) return
  if (!into.actor_resource_id && from.actor_resource_id) {
    await sb.from('characters').update({ actor_resource_id: from.actor_resource_id }).eq('id', intoId)
  }
  await sb.from('scene_elements').update({ character_id: intoId, name: into.name }).eq('character_id', fromId)
  await sb.from('characters').delete().eq('id', fromId)
  await syncCharacterRequirements(sb, intoId)
}

/** Delete a character and remove it from every scene's breakdown. */
export async function deleteCharacter(sb: Client, characterId: string) {
  const { data: elements } = await sb.from('scene_elements').select('id').eq('character_id', characterId)
  const ids = (elements || []).map((e) => e.id)
  if (ids.length) {
    await sb.from('scene_requirements').delete().in('element_id', ids)
    await sb.from('scene_elements').delete().in('id', ids)
  }
  await sb.from('characters').delete().eq('id', characterId)
}

/**
 * Give every un-numbered character a cast number, continuing after the highest one in use.
 * Order: most scenes first, then earliest appearance — the usual 1st AD convention.
 */
export async function assignCastNumbers(sb: Client, projectId: string) {
  const characters = await listCharacters(sb, projectId)
  const missing = characters.filter((c) => c.cast_number == null)
  if (missing.length === 0) return

  const { data: elements } = await sb
    .from('scene_elements')
    .select('character_id, scenes(scene_order)')
    .in(
      'character_id',
      missing.map((c) => c.id)
    )
  const stats = new Map<string, { count: number; first: number }>()
  for (const e of (elements || []) as unknown as Array<{ character_id: string; scenes: { scene_order: number | null } | null }>) {
    const s = stats.get(e.character_id) || { count: 0, first: Infinity }
    s.count++
    s.first = Math.min(s.first, e.scenes?.scene_order ?? Infinity)
    stats.set(e.character_id, s)
  }
  let next = characters.reduce((m, c) => Math.max(m, c.cast_number || 0), 0) + 1
  const ordered = [...missing].sort((a, b) => {
    const sa = stats.get(a.id) || { count: 0, first: Infinity }
    const sb2 = stats.get(b.id) || { count: 0, first: Infinity }
    return sb2.count - sa.count || sa.first - sb2.first || a.name.localeCompare(b.name)
  })
  const numbered = ordered.map((c) => ({ id: c.id, cast_number: next++ }))
  await forEachLimit(numbered, 10, (c) => sb.from('characters').update({ cast_number: c.cast_number }).eq('id', c.id))
}

/**
 * One-time upgrade of data created before characters existed, where a PERSON entry held both
 * the actor (name) and the character (display_name), or "TBC" + character for uncast roles.
 * Idempotent: CAST items that already have a character are skipped.
 */
export async function migrateLegacyCast(sb: Client, projectId: string) {
  const { data: scenes } = await sb.from('scenes').select('id').eq('project_id', projectId)
  const sceneIds = (scenes || []).map((s) => s.id)
  if (sceneIds.length === 0) return

  const { data: castElements } = await sb
    .from('scene_elements')
    .select('*')
    .in('scene_id', sceneIds)
    .eq('element_type', 'CAST')
    .is('character_id', null)
  if (!castElements || castElements.length === 0) return

  const { data: reqs } = await sb
    .from('scene_requirements')
    .select('element_id, resource_id, resources(id, name, display_name, resource_type)')
    .in(
      'element_id',
      castElements.map((e) => e.id)
    )
  const legacyByElement = new Map(
    ((reqs || []) as unknown as Array<{
      element_id: string
      resources: { id: string; name: string; display_name: string | null; resource_type: string } | null
    }>).map((r) => [r.element_id, r.resources])
  )

  const cache = await listCharacters(sb, projectId)
  const placeholders = new Set<string>()

  for (const el of castElements) {
    const legacy = legacyByElement.get(el.id)
    const characterName = legacy?.display_name || el.name
    const character = await findOrCreateCharacter(sb, projectId, characterName, cache)
    if (!character) continue

    // A real actor on the old entry becomes the character's casting
    if (legacy && legacy.resource_type === 'PERSON' && legacy.name !== LEGACY_UNCAST && !character.actor_resource_id) {
      await sb.from('characters').update({ actor_resource_id: legacy.id }).eq('id', character.id)
      character.actor_resource_id = legacy.id
    }
    if (legacy && legacy.name === LEGACY_UNCAST) placeholders.add(legacy.id)

    await linkCastElement(sb, projectId, el, character.id, cache)
  }

  // Old "TBC" placeholder people are no longer needed once nothing points at them
  for (const id of placeholders) {
    const { count } = await sb.from('scene_requirements').select('id', { count: 'exact', head: true }).eq('resource_id', id)
    const { count: playing } = await sb.from('characters').select('id', { count: 'exact', head: true }).eq('actor_resource_id', id)
    if (!count && !playing) await sb.from('resources').delete().eq('id', id)
  }

  await assignCastNumbers(sb, projectId)
}
