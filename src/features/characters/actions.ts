'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import { recordActivity } from '@/features/collaboration/lib/activity'
import {
  assignCastNumbers,
  castCharacter,
  deleteCharacter,
  findOrCreateCharacter,
  listCharacters,
  migrateLegacyCast,
  renameCharacter,
} from './lib/characters'

export interface CharacterOverview {
  id: string
  name: string
  castNumber: number | null
  actor: { id: string; name: string } | null
  sceneCount: number
  firstScene: string | null
}

export interface CastingData {
  /** true until supabase/migrations/020_characters.sql has been run */
  setupRequired?: boolean
  characters: CharacterOverview[]
  people: Array<{ id: string; name: string; playing: string[] }>
}

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/resources`)
  revalidatePath(`/projects/${projectId}/breakdown`)
  revalidatePath(`/projects/${projectId}/callsheets`)
  revalidatePath(`/projects/${projectId}/reports`)
}

/** Characters with casting and scene counts, plus the people who can be cast. */
export async function getCastingDataAction(projectId: string): Promise<CastingData> {
  const supabase = await createClient()
  const { error: tableError } = await supabase.from('characters').select('id').limit(1)
  if (tableError) return { setupRequired: true, characters: [], people: [] }

  await migrateLegacyCast(supabase, projectId)
  await assignCastNumbers(supabase, projectId)

  const [characters, { data: people }] = await Promise.all([
    listCharacters(supabase, projectId),
    supabase
      .from('resources')
      .select('id, name')
      .eq('project_id', projectId)
      .eq('resource_type', 'PERSON')
      .eq('is_active', true)
      .order('name'),
  ])

  const ids = characters.map((c) => c.id)
  const { data: elements } = ids.length
    ? await supabase.from('scene_elements').select('character_id, scenes(scene_number, scene_order)').in('character_id', ids)
    : { data: [] }
  const usage = new Map<string, { count: number; first: { number: string; order: number } | null }>()
  for (const e of (elements || []) as unknown as Array<{
    character_id: string
    scenes: { scene_number: string; scene_order: number | null } | null
  }>) {
    const u = usage.get(e.character_id) || { count: 0, first: null }
    u.count++
    const order = e.scenes?.scene_order ?? Infinity
    if (e.scenes && (!u.first || order < u.first.order)) u.first = { number: e.scenes.scene_number, order }
    usage.set(e.character_id, u)
  }

  const personName = new Map((people || []).map((p) => [p.id, p.name]))
  return {
    characters: characters.map((c) => ({
      id: c.id,
      name: c.name,
      castNumber: c.cast_number,
      actor: c.actor_resource_id ? { id: c.actor_resource_id, name: personName.get(c.actor_resource_id) || 'Unknown' } : null,
      sceneCount: usage.get(c.id)?.count || 0,
      firstScene: usage.get(c.id)?.first?.number || null,
    })),
    people: (people || []).map((p) => ({
      id: p.id,
      name: p.name,
      playing: characters.filter((c) => c.actor_resource_id === p.id).map((c) => c.name),
    })),
  }
}

export async function createCharacterAction(projectId: string, name: string) {
  const supabase = await createClient()
  const character = await findOrCreateCharacter(supabase, projectId, name)
  if (!character) return { error: 'Enter a character name.' }
  await assignCastNumbers(supabase, projectId)
  refresh(projectId)
  return { success: true }
}

/** Cast a character (actorId), uncast it (null), or cast a brand-new actor by name. */
export async function castCharacterAction(
  projectId: string,
  characterId: string,
  actor: { id: string } | { newName: string } | null
) {
  const supabase = await createClient()
  let actorId: string | null = null
  let actorName = ''

  if (actor && 'newName' in actor) {
    actorName = actor.newName.trim()
    if (!actorName) return { error: 'Enter the actor’s name.' }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: created, error } = await supabase
      .from('resources')
      .insert({ project_id: projectId, resource_type: 'PERSON', name: actorName, created_by: user?.id ?? null })
      .select('id')
      .single()
    if (error || !created) return { error: error?.message || 'Could not add the actor.' }
    actorId = created.id
    await recordActivity(projectId, 'RESOURCE_ADDED', `Added ${actorName} to Cast & Crew`)
  } else if (actor) {
    actorId = actor.id
    const { data: r } = await supabase.from('resources').select('name').eq('id', actor.id).single()
    actorName = r?.name || ''
  }

  const { data: character } = await supabase.from('characters').select('name').eq('id', characterId).single()
  await castCharacter(supabase, characterId, actorId)
  await syncProjectBookings(supabase, projectId)
  await recordActivity(
    projectId,
    'RESOURCE_ADDED',
    actorId ? `Cast ${actorName} as ${character?.name ?? 'a character'}` : `${character?.name ?? 'A character'} is now uncast`
  )
  refresh(projectId)
  return { success: true }
}

export async function renameCharacterAction(projectId: string, characterId: string, name: string) {
  const supabase = await createClient()
  const res = await renameCharacter(supabase, characterId, name)
  if (res.error) return { error: res.error }
  await syncProjectBookings(supabase, projectId)
  refresh(projectId)
  return { success: true, merged: Boolean(res.mergedInto) }
}

/** Set a cast number; if another character has it, they swap. */
export async function setCastNumberAction(projectId: string, characterId: string, castNumber: number) {
  if (!Number.isInteger(castNumber) || castNumber < 1) return { error: 'Cast numbers are whole numbers from 1.' }
  const supabase = await createClient()
  const all = await listCharacters(supabase, projectId)
  const me = all.find((c) => c.id === characterId)
  const other = all.find((c) => c.cast_number === castNumber && c.id !== characterId)
  if (other) await supabase.from('characters').update({ cast_number: me?.cast_number ?? null }).eq('id', other.id)
  await supabase.from('characters').update({ cast_number: castNumber }).eq('id', characterId)
  refresh(projectId)
  return { success: true }
}

export async function deleteCharacterAction(projectId: string, characterId: string) {
  const supabase = await createClient()
  const { data: character } = await supabase.from('characters').select('name').eq('id', characterId).single()
  await deleteCharacter(supabase, characterId)
  await syncProjectBookings(supabase, projectId)
  if (character) await recordActivity(projectId, 'RESOURCE_REMOVED', `Removed character ${character.name}`)
  refresh(projectId)
  return { success: true }
}
