'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  SceneElementItem,
  SceneTagItem,
  SceneNoteItem,
  SceneElementType,
  ElementConfirmStatus,
  SceneTagType,
  Database,
} from '@/types/database'
import { extractElementsFromSceneText } from './lib/parser-utils'
import {
  LINKED_RESOURCE_TYPE,
  breakdownLabel,
  getLinkableResources,
  propagateResourceLabel,
  reconcileElementLink,
  syncProjectBookings,
  syncProjectLinks,
  unlinkElement,
} from './lib/resource-links'
import { linkCastElement, listCharacters } from '@/features/characters/lib/characters'
import { ONE_LINER_MIGRATION_HINT } from './lib/one-liners'


type ResourceRow = Database['public']['Tables']['resources']['Row']

/** A breakdown CAST item's character and who plays them. */
export interface LinkedCharacter {
  id: string
  name: string
  castNumber: number | null
  actor: { id: string; name: string } | null
}

/** The Cast & Crew entry an element is linked to. */
export type LinkedResource = Pick<ResourceRow, 'id' | 'name' | 'display_name' | 'resource_type'> & {
  /** How many scenes in the project need this entry */
  sceneCount?: number
}

export interface SceneBreakdownData {
  scene: Database['public']['Tables']['scenes']['Row']
  elements: SceneElementItem[]
  tags: SceneTagItem[]
  notes: SceneNoteItem[]
  /** element id → linked Cast & Crew entry */
  links: Record<string, LinkedResource>
  /** CAST element id → its character (and actor) */
  characters: Record<string, LinkedCharacter>
}

export interface ProjectBreakdownStats {
  totalScenes: number
  reviewedScenes: number
  confirmedScenes: number
  totalElements: number
  confirmedElements: number
  elementCountsByType: Record<string, number>
}

/**
 * Fetch full breakdown data (scene, elements, tags, notes) for a specific scene
 */
export async function getSceneBreakdownAction(sceneId: string): Promise<SceneBreakdownData | null> {
  const supabase = createClient()

  // 1. Fetch Scene
  const { data: scene, error: sceneErr } = await supabase
    .from('scenes')
    .select('*')
    .eq('id', sceneId)
    .single()

  if (sceneErr || !scene) {
    console.error('Failed to fetch scene for breakdown:', sceneErr)
    return null
  }

  // 2. Fetch Scene Elements
  const { data: elements } = await supabase
    .from('scene_elements')
    .select('*')
    .eq('scene_id', sceneId)
    .order('element_type', { ascending: true })
    .order('name', { ascending: true })

  // 3. Fetch Scene Tags
  const { data: tags } = await supabase
    .from('scene_tags')
    .select('*')
    .eq('scene_id', sceneId)

  // 4. Fetch Scene Notes
  const { data: notes } = await supabase
    .from('scene_notes')
    .select('*')
    .eq('scene_id', sceneId)
    .order('created_at', { ascending: false })

  // 5. Fetch Cast & Crew links for these elements
  const { data: requirements } = await supabase
    .from('scene_requirements')
    .select('element_id, resources(id, name, display_name, resource_type)')
    .eq('scene_id', sceneId)

  const links: Record<string, LinkedResource> = {}
  for (const r of requirements || []) {
    const res = r.resources as unknown as LinkedResource | null
    if (r.element_id && res) links[r.element_id] = { ...res }
  }

  const resourceIds = Array.from(new Set(Object.values(links).map((l) => l.id)))
  if (resourceIds.length) {
    const { data: usage, error: usageErr } = await supabase
      .from('scene_requirements')
      .select('resource_id, scene_id')
      .in('resource_id', resourceIds)
    if (usageErr) console.error('Failed to count scene usage for breakdown links:', usageErr)
    const scenesByResource = new Map<string, Set<string>>()
    for (const u of usage || []) {
      if (!u.resource_id || !u.scene_id) continue
      const set = scenesByResource.get(u.resource_id) ?? new Set<string>()
      set.add(u.scene_id)
      scenesByResource.set(u.resource_id, set)
    }
    for (const l of Object.values(links)) {
      const count = scenesByResource.get(l.id)?.size
      if (count) l.sceneCount = count
    }
  }

  // 6. Characters for CAST items
  const characterIds = Array.from(new Set((elements || []).map((e) => e.character_id).filter((id): id is string => !!id)))
  const characters: Record<string, LinkedCharacter> = {}
  if (characterIds.length) {
    const { data: rows } = await supabase
      .from('characters')
      .select('id, name, cast_number, resources(id, name)')
      .in('id', characterIds)
    const byId = new Map(
      ((rows || []) as unknown as Array<{ id: string; name: string; cast_number: number | null; resources: { id: string; name: string } | null }>).map(
        (c) => [c.id, { id: c.id, name: c.name, castNumber: c.cast_number, actor: c.resources }]
      )
    )
    for (const e of elements || []) {
      const c = e.character_id ? byId.get(e.character_id) : undefined
      if (c) characters[e.id] = c
    }
  }

  return {
    scene,
    elements: elements || [],
    tags: tags || [],
    notes: notes || [],
    links,
    characters,
  }
}

/** Characters in the production (for the cast picker), with who plays them. */
export async function getCharactersAction(projectId: string) {
  const supabase = createClient()
  const rows = await listCharacters(supabase, projectId)
  const actorIds = rows.map((r) => r.actor_resource_id).filter((id): id is string => !!id)
  const { data: actors } = actorIds.length
    ? await supabase.from('resources').select('id, name').in('id', actorIds)
    : { data: [] }
  const actorName = new Map((actors || []).map((a) => [a.id, a.name]))
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    castNumber: r.cast_number,
    actorName: r.actor_resource_id ? actorName.get(r.actor_resource_id) ?? null : null,
  }))
}

/**
 * Link every confirmed breakdown element to Cast & Crew and rebuild shoot-day bookings.
 * Idempotent; run when the Breakdown opens so older data is brought in sync.
 */
export async function syncBreakdownWithResourcesAction(projectId: string) {
  const supabase = createClient()
  await syncProjectLinks(supabase, projectId)
}

/** Existing Cast & Crew entries that a breakdown category can be linked to. */
export async function getLinkableResourcesAction(projectId: string, elementType: SceneElementType) {
  return getLinkableResources(createClient(), projectId, elementType)
}

export function isLinkableElementType(elementType: SceneElementType) {
  return !!LINKED_RESOURCE_TYPE[elementType]
}

async function getSceneProjectId(supabase: ReturnType<typeof createClient>, sceneId: string) {
  const { data } = await supabase.from('scenes').select('project_id').eq('id', sceneId).single()
  return data?.project_id ?? null
}

/**
 * Fetch project breakdown overall stats
 */
export async function getProjectBreakdownStatsAction(
  projectId: string
): Promise<ProjectBreakdownStats> {
  const supabase = createClient()

  // Fetch all scenes in project
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, status')
    .eq('project_id', projectId)

  const totalScenes = scenes?.length || 0
  const reviewedScenes = scenes?.filter((s) => s.status === 'REVIEWED' || s.status === 'CONFIRMED' || s.status === 'LOCKED').length || 0
  const confirmedScenes = scenes?.filter((s) => s.status === 'CONFIRMED' || s.status === 'LOCKED').length || 0

  // Fetch all elements for project's scenes
  const sceneIds = (scenes || []).map((s) => s.id)
  let totalElements = 0
  let confirmedElements = 0
  const counts: Record<string, number> = {}

  if (sceneIds.length > 0) {
    const { data: elements } = await supabase
      .from('scene_elements')
      .select('element_type, confirm_status')
      .in('scene_id', sceneIds)

    if (elements) {
      totalElements = elements.length
      confirmedElements = elements.filter((e) => e.confirm_status === 'CONFIRMED' || e.confirm_status === 'EDITED').length
      elements.forEach((e) => {
        counts[e.element_type] = (counts[e.element_type] || 0) + 1
      })
    }
  }

  return {
    totalScenes,
    reviewedScenes,
    confirmedScenes,
    totalElements,
    confirmedElements,
    elementCountsByType: counts,
  }
}

/**
 * Save a scene's one-liner as written by a person (AI never overwrites it after this).
 * An empty one-liner clears it so AI can draft it again.
 */
export async function saveSceneOneLinerAction(
  sceneId: string,
  synopsis: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  const text = synopsis.replace(/\s+/g, ' ').trim()
  const { data, error } = await supabase
    .from('scenes')
    .update({ synopsis: text || null, synopsis_source: text ? 'USER' : null, updated_at: new Date().toISOString() })
    .eq('id', sceneId)
    .select('id')
  if (error) {
    return { success: false, error: /synopsis/.test(error.message) ? ONE_LINER_MIGRATION_HINT : error.message }
  }
  if (!data?.length) return { success: false, error: 'You do not have edit access to this production.' }
  return { success: true }
}

/** One character in the one-liner report's cast legend */
export interface OneLinerCastEntry {
  /** cast number as printed ("1"), or the name when the character has no number yet */
  id: string
  name: string
  castNumber: number | null
}

export interface OneLinerReportData {
  /** scene id → cast ids in that scene, in cast-number order */
  castByScene: Record<string, string[]>
  cast: OneLinerCastEntry[]
}

/**
 * Cast for the one-liner report: each scene's characters by cast number (the same numbers as
 * the call sheet and Day Out of Days), plus the legend of every character in those scenes.
 */
export async function getOneLinerReportAction(sceneIds: string[]): Promise<OneLinerReportData> {
  const supabase = createClient()
  type CastItem = {
    scene_id: string
    name: string
    characters: { id: string; name: string; cast_number: number | null } | null
  }
  const items: CastItem[] = []
  for (let i = 0; i < sceneIds.length; i += 150) {
    const { data, error } = await supabase
      .from('scene_elements')
      .select('scene_id, name, characters(id, name, cast_number)')
      .in('scene_id', sceneIds.slice(i, i + 150))
      .eq('element_type', 'CAST')
    if (error) throw new Error(`Could not load the cast: ${error.message}`)
    items.push(...((data || []) as unknown as CastItem[]))
  }

  // A CAST item not linked to a character yet is listed by its name
  const entryFor = (item: CastItem): OneLinerCastEntry => {
    const c = item.characters
    if (!c) return { id: item.name.toUpperCase(), name: item.name.toUpperCase(), castNumber: null }
    return { id: c.cast_number != null ? String(c.cast_number) : c.name, name: c.name, castNumber: c.cast_number }
  }
  const byOrder = (a: OneLinerCastEntry, b: OneLinerCastEntry) =>
    (a.castNumber ?? Infinity) - (b.castNumber ?? Infinity) || a.name.localeCompare(b.name)

  const legend = new Map<string, OneLinerCastEntry>()
  const perScene = new Map<string, Map<string, OneLinerCastEntry>>()
  for (const item of items) {
    const entry = entryFor(item)
    legend.set(entry.id, entry)
    if (!perScene.has(item.scene_id)) perScene.set(item.scene_id, new Map())
    perScene.get(item.scene_id)!.set(entry.id, entry)
  }

  const castByScene: Record<string, string[]> = {}
  perScene.forEach((entries, sceneId) => {
    castByScene[sceneId] = Array.from(entries.values()).sort(byOrder).map((e) => e.id)
  })
  return { castByScene, cast: Array.from(legend.values()).sort(byOrder) }
}

/**
 * Add a manual element to a scene
 */
export async function addSceneElementAction(
  sceneId: string,
  elementType: SceneElementType,
  name: string,
  description?: string,
  notes?: string,
  resourceId?: string
): Promise<{ success: boolean; element?: SceneElementItem; error?: string }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('scene_elements')
    .insert({
      scene_id: sceneId,
      element_type: elementType,
      name: name.trim().toUpperCase(),
      description: description || null,
      notes: notes || null,
      confirm_status: 'CONFIRMED',
      ai_confidence: 100,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to add element' }
  }

  // Link to (or create) the character / Cast & Crew entry, then refresh bookings
  const projectId = await getSceneProjectId(supabase, sceneId)
  if (projectId && elementType === 'CAST') {
    await linkCastElement(supabase, projectId, data, resourceId)
    await syncProjectBookings(supabase, projectId)
  } else if (projectId && LINKED_RESOURCE_TYPE[elementType]) {
    await reconcileElementLink(supabase, projectId, data, resourceId)
    await syncProjectBookings(supabase, projectId)
  }

  return { success: true, element: data }
}

/**
 * Update an element's details or confirmation status
 */
export async function updateSceneElementAction(
  elementId: string,
  updates: {
    name?: string
    elementType?: SceneElementType
    confirmStatus?: ElementConfirmStatus
    notes?: string
    description?: string
    resourceId?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { data: before } = await supabase.from('scene_elements').select('*').eq('id', elementId).single()
  if (!before) return { success: false, error: 'Element not found' }

  const payload: Partial<Database['public']['Tables']['scene_elements']['Update']> = {}
  if (updates.name !== undefined) payload.name = updates.name.trim().toUpperCase()
  if (updates.elementType !== undefined) payload.element_type = updates.elementType
  if (updates.confirmStatus !== undefined) payload.confirm_status = updates.confirmStatus
  if (updates.notes !== undefined) payload.notes = updates.notes
  if (updates.description !== undefined) payload.description = updates.description
  payload.updated_at = new Date().toISOString()

  const { data: after, error } = await supabase
    .from('scene_elements')
    .update(payload)
    .eq('id', elementId)
    .select('*')
    .single()

  if (error || !after) {
    return { success: false, error: error?.message || 'Failed to update element' }
  }

  const projectId = await getSceneProjectId(supabase, after.scene_id)
  if (!projectId) return { success: true }

  const renamed = payload.name !== undefined && payload.name !== before.name
  const retyped = payload.element_type !== undefined && payload.element_type !== before.element_type

  // Cast: a new name in this scene points the item at that character (created if new).
  // Renaming a character for the whole production is done in Cast & Crew → Characters.
  if (after.element_type === 'CAST' || before.element_type === 'CAST') {
    if (retyped || renamed) {
      await supabase.from('scene_requirements').delete().eq('element_id', elementId)
      await supabase.from('scene_elements').update({ character_id: null }).eq('id', elementId)
    }
    if (after.element_type === 'CAST' && (after.confirm_status === 'CONFIRMED' || after.confirm_status === 'EDITED')) {
      await linkCastElement(supabase, projectId, { ...after, character_id: retyped || renamed ? null : after.character_id }, updates.resourceId)
    } else if (after.element_type === 'CAST') {
      await supabase.from('scene_requirements').delete().eq('element_id', elementId)
    } else {
      await reconcileElementLink(supabase, projectId, after, updates.resourceId)
    }
    await syncProjectBookings(supabase, projectId)
    return { success: true }
  }

  const { data: link } = await supabase
    .from('scene_requirements')
    .select('resource_id')
    .eq('element_id', elementId)
    .maybeSingle()

  if (link && renamed && !retyped && !updates.resourceId) {
    // Renaming a linked element renames the Cast & Crew entry everywhere — unless the new name
    // already belongs to another entry, in which case the element is re-pointed to that one.
    const candidates = await getLinkableResources(supabase, projectId, after.element_type)
    const other = candidates.find((r) => r.id !== link.resource_id && breakdownLabel(r) === payload.name)
    if (other) {
      await reconcileElementLink(supabase, projectId, after, other.id)
    } else {
      const current = candidates.find((r) => r.id === link.resource_id)
      const rename = current?.resource_type === 'PERSON' ? { display_name: payload.name } : { name: payload.name }
      await supabase.from('resources').update(rename).eq('id', link.resource_id)
      await propagateResourceLabel(supabase, link.resource_id)
    }
  } else {
    if (retyped) await unlinkElement(supabase, elementId)
    await reconcileElementLink(supabase, projectId, after, updates.resourceId)
  }

  await syncProjectBookings(supabase, projectId)
  return { success: true }
}

/**
 * Delete a scene element
 */
export async function deleteSceneElementAction(elementId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { data: element } = await supabase.from('scene_elements').select('scene_id').eq('id', elementId).single()

  // Drop the Cast & Crew link first (the FK would otherwise leave an orphaned requirement)
  await unlinkElement(supabase, elementId)

  const { error } = await supabase
    .from('scene_elements')
    .delete()
    .eq('id', elementId)

  if (error) {
    return { success: false, error: error.message }
  }

  const projectId = element ? await getSceneProjectId(supabase, element.scene_id) : null
  if (projectId) await syncProjectBookings(supabase, projectId)
  return { success: true }
}

/**
 * Heuristically auto-extract elements from scene text and batch insert into Supabase
 */
export async function autoExtractSceneElementsAction(
  sceneId: string
): Promise<{ success: boolean; insertedCount: number; error?: string }> {
  const supabase = createClient()

  // 1. Fetch Scene
  const { data: scene } = await supabase
    .from('scenes')
    .select('heading, description, location_name')
    .eq('id', sceneId)
    .single()

  if (!scene) {
    return { success: false, insertedCount: 0, error: 'Scene not found' }
  }

  // 2. Extract elements
  const extracted = extractElementsFromSceneText(scene.heading, scene.description, scene.location_name)
  if (extracted.length === 0) {
    return { success: true, insertedCount: 0 }
  }

  // 3. Fetch existing elements to prevent duplicates
  const { data: existing } = await supabase
    .from('scene_elements')
    .select('element_type, name')
    .eq('scene_id', sceneId)

  const existingSet = new Set((existing || []).map((e) => `${e.element_type}:${e.name.toUpperCase()}`))

  const newToInsert = extracted
    .filter((e) => !existingSet.has(`${e.elementType}:${e.name.toUpperCase()}`))
    .map((e) => ({
      scene_id: sceneId,
      element_type: e.elementType,
      name: e.name,
      description: e.description || null,
      ai_confidence: e.aiConfidence,
      confirm_status: 'AI_DETECTED' as ElementConfirmStatus,
    }))

  if (newToInsert.length === 0) {
    return { success: true, insertedCount: 0 }
  }

  const { error } = await supabase
    .from('scene_elements')
    .insert(newToInsert)

  if (error) {
    return { success: false, insertedCount: 0, error: error.message }
  }

  return { success: true, insertedCount: newToInsert.length }
}

/**
 * Confirm all elements for a scene and mark scene status as CONFIRMED
 */
export async function confirmAllSceneElementsAction(
  sceneId: string,
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Update all elements to CONFIRMED
  const { error: elemErr } = await supabase
    .from('scene_elements')
    .update({ confirm_status: 'CONFIRMED', updated_at: new Date().toISOString() })
    .eq('scene_id', sceneId)

  if (elemErr) {
    return { success: false, error: elemErr.message }
  }

  // Update scene status to CONFIRMED
  const { error: sceneErr } = await supabase
    .from('scenes')
    .update({ status: 'CONFIRMED', updated_at: new Date().toISOString() })
    .eq('id', sceneId)

  if (sceneErr) {
    return { success: false, error: sceneErr.message }
  }

  // Confirmed elements become Cast & Crew entries
  const { data: confirmed } = await supabase.from('scene_elements').select('*').eq('scene_id', sceneId)
  for (const el of confirmed || []) {
    await reconcileElementLink(supabase, projectId, el)
  }
  await syncProjectBookings(supabase, projectId)

  return { success: true }
}

/**
 * Add a tag to a scene (e.g. STUNT, NIGHT_SHOOT, WATER)
 */
export async function addSceneTagAction(
  projectId: string,
  sceneId: string,
  tagType: SceneTagType,
  label: string,
  color?: string
): Promise<{ success: boolean; tag?: SceneTagItem; error?: string }> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('scene_tags')
    .insert({
      project_id: projectId,
      scene_id: sceneId,
      tag_type: tagType,
      label: label.trim().toUpperCase(),
      color: color || '#f59e0b',
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to add scene tag' }
  }

  return { success: true, tag: data }
}

/**
 * Delete a tag from a scene
 */
export async function deleteSceneTagAction(tagId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { error } = await supabase
    .from('scene_tags')
    .delete()
    .eq('id', tagId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
