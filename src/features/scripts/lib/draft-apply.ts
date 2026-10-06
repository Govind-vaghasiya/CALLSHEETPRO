/**
 * Applying a new draft's changes to the project's scenes, scene by scene (see draft-compare.ts).
 * Server only: callers check permission first.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { reconcileElementLink, unlinkElement } from '@/features/breakdown/lib/resource-links'
import { hasOneLinerColumns } from '@/features/breakdown/lib/one-liners'
import { normalizeCharacterName } from '@/features/characters/lib/character-cues'
import { forEachLimit } from '@/lib/async'
import { extractScenesFromPages } from './parser'
import { relinkSceneLocation } from './scene-sync'
import {
  buildDraft,
  compareDrafts,
  rowStatus,
  statusContext,
  type CompareRow,
  type Draft,
  type PairOverrides,
  type ProjectSceneState,
  type RowDecision,
} from './draft-compare'

type Client = SupabaseClient<Database>
type SceneUpdate = Database['public']['Tables']['scenes']['Update']
type SceneInsert = Database['public']['Tables']['scenes']['Insert']

/** Migration 025 adds tracked changes and decimal versions; code works without them until it is run. */
export const TRACKED_CHANGES_MIGRATION_HINT =
  'Highlighted changes and decimal versions need a one-time database update: run supabase/migrations/025_script_versions_and_tracked_changes.sql in the Supabase SQL Editor.'

export async function hasTrackedChangeColumns(sb: Client): Promise<boolean> {
  const { error } = await sb.from('scenes').select('accepted_description').limit(1)
  return !error
}

const normalize = (n: string) => n.trim().toUpperCase().replace(/^#/, '')

/** Rebuild a draft's scenes from its stored pages. */
export async function loadDraft(sb: Client, documentId: string): Promise<Draft | null> {
  const { data: pages, error } = await sb
    .from('script_pages')
    .select('page_number, raw_text')
    .eq('script_document_id', documentId)
    .order('page_number', { ascending: true })
  if (error) throw new Error(`Could not read the draft's pages: ${error.message}`)
  if (!pages?.length) return null
  const parsed = pages.map((p) => ({ pageNumber: p.page_number, rawText: p.raw_text || '' }))
  return buildDraft(documentId, parsed, extractScenesFromPages(parsed))
}

/** The project's scenes with what the compare view shows about them (cast, shoot days, call sheets). */
export async function loadProjectScenes(sb: Client, projectId: string): Promise<ProjectSceneState[]> {
  const { data: scenes, error } = await sb.from('scenes').select('*').eq('project_id', projectId)
  if (error) throw new Error(`Could not read the project's scenes: ${error.message}`)
  const ids = (scenes || []).map((s) => s.id)
  if (!ids.length) return []

  const [{ data: cast }, { data: placed }] = await Promise.all([
    sb.from('scene_elements').select('scene_id, name').eq('element_type', 'CAST').in('scene_id', ids),
    sb.from('shoot_day_scenes').select('scene_id, shoot_days(id, day_number, shoot_date)').in('scene_id', ids),
  ])
  const placements = (placed || []) as unknown as Array<{
    scene_id: string
    shoot_days: { id: string; day_number: number | null; shoot_date: string } | null
  }>
  const dayIds = Array.from(new Set(placements.map((p) => p.shoot_days?.id).filter((id): id is string => !!id)))
  const { data: sheets } = dayIds.length
    ? await sb.from('call_sheets').select('shoot_day_id, status, version').in('shoot_day_id', dayIds)
    : { data: [] as Array<{ shoot_day_id: string; status: ProjectSceneState['days'][number]['callSheet']; version: number }> }
  // Latest call sheet per day
  const sheetByDay = new Map<string, { status: ProjectSceneState['days'][number]['callSheet']; version: number }>()
  for (const s of sheets || []) {
    const prev = sheetByDay.get(s.shoot_day_id)
    if (!prev || s.version > prev.version) sheetByDay.set(s.shoot_day_id, { status: s.status, version: s.version })
  }

  return (scenes || []).map((s) => ({
    id: s.id,
    scene_number: s.scene_number,
    heading: s.heading,
    location_name: s.location_name,
    description: s.description,
    script_document_id: s.script_document_id,
    synopsis: (s as { synopsis?: string | null }).synopsis ?? null,
    accepted_heading: s.accepted_heading ?? null,
    accepted_description: s.accepted_description ?? null,
    cast: (cast || []).filter((c) => c.scene_id === s.id).map((c) => c.name.toUpperCase()),
    days: placements
      .filter((p) => p.scene_id === s.id && p.shoot_days)
      .map((p) => ({
        dayNumber: p.shoot_days!.day_number,
        date: p.shoot_days!.shoot_date,
        callSheet: sheetByDay.get(p.shoot_days!.id)?.status ?? null,
      })),
  }))
}

export interface ApplyDraftResult {
  updated: number
  added: number
  deleted: number
  /** Scenes the new draft dropped, renumbered out of the way ("5 OMITTED") */
  parked: string[]
  skipped: Array<{ key: string; reason: string }>
}

/**
 * Apply the picked rows of a draft comparison to the project's scenes.
 * Scenes keep their ids, so breakdown, Cast & Crew links and schedule placement carry over.
 * The caller then links new breakdown items (syncProjectLinks) and rebuilds bookings.
 */
export async function applyDraftChanges(
  sb: Client,
  projectId: string,
  oldDocumentId: string,
  newDocumentId: string,
  overrides: PairOverrides,
  /** 'ALL': every change with the default choices (merge a whole draft into the master) */
  picked: RowDecision[] | 'ALL'
): Promise<ApplyDraftResult & { newDoc: { file_name: string; version: number } }> {
  const { data: docs } = await sb
    .from('script_documents')
    .select('id, project_id, file_name, version, revision_color')
    .in('id', [oldDocumentId, newDocumentId])
  const newDoc = docs?.find((d) => d.id === newDocumentId)
  if (!newDoc || docs?.some((d) => d.project_id !== projectId) || (docs?.length ?? 0) < (oldDocumentId === newDocumentId ? 1 : 2)) {
    throw new Error('Those drafts could not be found.')
  }

  const [oldDraft, newDraft, projectScenes] = await Promise.all([
    loadDraft(sb, oldDocumentId),
    loadDraft(sb, newDocumentId),
    loadProjectScenes(sb, projectId),
  ])
  if (!oldDraft || !newDraft) throw new Error('One of the drafts has no readable pages.')

  const rows = compareDrafts(oldDraft, newDraft, overrides)
  const rowByKey = new Map(rows.map((r) => [r.key, r]))
  const ctx = statusContext(rows, projectScenes, oldDraft, newDraft)
  const byNumber = ctx.byNumber
  const withOneLinerColumns = await hasOneLinerColumns(sb)
  const tracking = await hasTrackedChangeColumns(sb)
  const now = new Date().toISOString()
  const result: ApplyDraftResult = { updated: 0, added: 0, deleted: 0, parked: [], skipped: [] }
  // Merging everything: changed, new and renumbered scenes; omitted scenes stay (delete them in Compare)
  const decisions: RowDecision[] =
    picked === 'ALL'
      ? rows
          .filter((r) => (r.kind !== 'UNCHANGED' || r.renumbered) && r.kind !== 'OMITTED')
          .map((r) => {
            const cast = new Set(rowStatus(r, ctx).scene?.cast ?? [])
            return { key: r.key, addCast: r.charactersAdded.filter((c) => !cast.has(c)), removeCast: [] }
          })
      : picked

  // The new draft's scene text and layout, as scene sync stores it
  const parsedNew = new Map(
    (await sb
      .from('script_pages')
      .select('page_number, raw_text')
      .eq('script_document_id', newDocumentId)
      .order('page_number', { ascending: true })
      .then(({ data }) => extractScenesFromPages((data || []).map((p) => ({ pageNumber: p.page_number, rawText: p.raw_text || '' })))))
      .map((p) => [p.sceneNumber.trim().toUpperCase().replace(/^#/, ''), p])
  )
  const fieldsFor = (number: string) => {
    const p = parsedNew.get(number)!
    const right = newDraft.scenes.find((s) => s.number === number)!
    return {
      script_document_id: newDocumentId,
      scene_order: right.index + 1,
      heading: p.heading,
      int_ext: p.intExt,
      location_name: p.locationName,
      time_of_day: p.timeOfDay,
      page_start: p.pageStart,
      page_end: p.pageEnd,
      // Stored without page headers, page numbers and (MORE)/(CONT'D) breaks
      description: `${p.heading}\n${right.body}`,
      estimated_duration: p.estimatedDuration,
      ...(withOneLinerColumns ? { page_eighths: p.pageEighths, time_of_day_label: p.timeLabel } : {}),
      updated_at: now,
    } satisfies SceneUpdate
  }

  // ---- Plan: what each picked row does
  type Plan =
    | { kind: 'update'; row: CompareRow; scene: ProjectSceneState; decision: RowDecision; changed: boolean }
    | { kind: 'insert'; row: CompareRow; decision: RowDecision }
    | { kind: 'delete'; row: CompareRow; scene: ProjectSceneState }
    | { kind: 'park'; row: CompareRow; scene: ProjectSceneState; number: string }
  let plans: Plan[] = []
  for (const decision of decisions) {
    const row = rowByKey.get(decision.key)
    if (!row) {
      result.skipped.push({ key: decision.key, reason: 'The scenes changed since the comparison was loaded — reload and try again.' })
      continue
    }
    const status = rowStatus(row, ctx)
    if (status.state === 'APPLIED') continue
    if (row.left && !row.right) {
      // Omitted from the new draft: deleted only when asked; otherwise nothing changes
      if (decision.deleteScene && status.scene) plans.push({ kind: 'delete', row, scene: status.scene })
      continue
    }
    if (status.scene) {
      plans.push({ kind: 'update', row, scene: status.scene, decision, changed: row.kind === 'CHANGED' || status.state === 'EDITED' })
    } else {
      plans.push({ kind: 'insert', row, decision })
    }
  }

  // Merging everything: a scene the new draft dropped keeps its breakdown and schedule, but
  // steps aside ("5 OMITTED") when the new draft gives its number to another scene — scripts
  // numbered in order reuse every number after a removed scene.
  if (picked === 'ALL') {
    const wanted = new Set(plans.filter((p) => p.kind !== 'delete').map((p) => p.row.right!.number))
    const taken = new Set(projectScenes.map((sc) => normalize(sc.scene_number)))
    for (const row of rows) {
      if (row.kind !== 'OMITTED' || !wanted.has(row.left!.number)) continue
      const status = rowStatus(row, ctx)
      if (status.state !== 'PENDING' || !status.scene) continue
      let number = `${row.left!.number} OMITTED`
      for (let k = 2; taken.has(number); k++) number = `${row.left!.number} OMITTED ${k}`
      taken.add(number)
      plans.push({ kind: 'park', row, scene: status.scene, number })
    }
  }

  // ---- A scene can only take a number that is free, or freed by this batch
  for (;;) {
    const leavingIds = new Set<string>()
    for (const p of plans) {
      if (p.kind === 'delete' || p.kind === 'park') leavingIds.add(p.scene.id)
      if (p.kind === 'update' && normalize(p.scene.scene_number) !== p.row.right!.number) leavingIds.add(p.scene.id)
    }
    const blocked = plans.find((p) => {
      if (p.kind === 'delete' || p.kind === 'park') return false
      const occupant = byNumber.get(p.row.right!.number)
      const self = p.kind === 'update' ? p.scene.id : null
      return occupant && occupant.id !== self && !leavingIds.has(occupant.id)
    })
    if (!blocked) break
    const n = blocked.row.right!.number
    const omitted = rows.some((r) => r.kind === 'OMITTED' && r.left!.number === n)
    result.skipped.push({
      key: blocked.row.key,
      reason: omitted
        ? `Scene ${n} is still in the app (it is omitted in the new draft) — delete it in the same apply, or renumber it first.`
        : `Scene number ${n} is used by another scene in the app — apply that scene's change too, or renumber it first.`,
    })
    plans = plans.filter((p) => p !== blocked)
  }

  const cleanCast = (names: string[]) => Array.from(new Set(names.map(normalizeCharacterName).filter(Boolean)))
  const updates: Array<{ id: string; values: SceneUpdate; finalNumber: string }> = []
  const inserts: Array<{ values: SceneInsert; addCast: string[] }> = []
  const castChanges: Array<{ sceneId: string; add: string[]; remove: string[] }> = []
  const relocations: Array<{ id: string; from: string | null; to: string | null }> = []
  const deletions: string[] = []

  for (const p of plans) {
    if (p.kind === 'delete') {
      deletions.push(p.scene.id)
      continue
    }
    if (p.kind === 'park') {
      updates.push({ id: p.scene.id, finalNumber: p.number, values: { updated_at: now } })
      result.parked.push(p.number)
      continue
    }
    const right = p.row.right!
    if (p.kind === 'insert') {
      inserts.push({
        values: {
          project_id: projectId,
          scene_number: right.number,
          status: 'DETECTED',
          revision_color: newDoc.revision_color,
          is_changed: true,
          ...fieldsFor(right.number),
          // A new scene: all of it is highlighted until accepted
          ...(tracking ? { accepted_heading: '', accepted_description: '', changes_from_document_id: newDocumentId } : {}),
        },
        addCast: cleanCast(p.decision.addCast),
      })
      continue
    }
    updates.push({
      id: p.scene.id,
      finalNumber: right.number,
      values: {
        ...fieldsFor(right.number),
        ...(p.changed ? { is_changed: true, revision_color: newDoc.revision_color } : {}),
        // Keep the last confirmed text (from before an earlier unreviewed merge, if any)
        ...(p.changed && tracking
          ? {
              accepted_heading: p.scene.accepted_heading ?? p.scene.heading ?? '',
              accepted_description: p.scene.accepted_description ?? p.scene.description ?? '',
              changes_from_document_id: newDocumentId,
            }
          : {}),
      },
    })
    castChanges.push({ sceneId: p.scene.id, add: cleanCast(p.decision.addCast), remove: cleanCast(p.decision.removeCast) })
    relocations.push({ id: p.scene.id, from: p.scene.location_name, to: parsedNew.get(right.number)?.locationName ?? null })
    result.updated++
  }

  // Unchanged scenes follow the new draft's page numbers and order (no text or breakdown change)
  for (const row of rows) {
    if (row.kind !== 'UNCHANGED' || row.renumbered || !row.left || !row.right) continue
    const status = rowStatus(row, ctx)
    if (status.state !== 'PENDING' || !status.scene || updates.some((u) => u.id === status.scene!.id)) continue
    const f = fieldsFor(row.right.number)
    updates.push({
      id: status.scene.id,
      finalNumber: row.right.number,
      values: {
        script_document_id: f.script_document_id,
        scene_order: f.scene_order,
        page_start: f.page_start,
        page_end: f.page_end,
        estimated_duration: f.estimated_duration,
        ...(withOneLinerColumns && 'page_eighths' in f ? { page_eighths: f.page_eighths } : {}),
        updated_at: now,
      },
    })
  }

  // 1. Deletions first (frees their numbers)
  if (deletions.length) {
    const { error } = await sb.from('scenes').delete().in('id', deletions)
    if (error) throw new Error(`Could not delete omitted scenes: ${error.message}`)
    result.deleted = deletions.length
  }

  // 2. Renumbering goes through temporary numbers so swaps (12 ↔ 13) never collide
  const renumbered = updates.filter((u) => {
    const scene = projectScenes.find((s) => s.id === u.id)
    return scene && normalize(scene.scene_number) !== u.finalNumber
  })
  for (const u of renumbered) {
    const { error } = await sb.from('scenes').update({ scene_number: `~${u.id}` }).eq('id', u.id)
    if (error) throw new Error(`Could not renumber scenes: ${error.message}`)
  }
  for (const u of renumbered) u.values.scene_number = u.finalNumber

  // 3. Updates and inserts
  let updateError: string | null = null
  await forEachLimit(updates, 10, async (u) => {
    const { error } = await sb.from('scenes').update(u.values).eq('id', u.id)
    if (error) updateError = `Scene ${u.finalNumber}: ${error.message}`
  })
  if (updateError) throw new Error(`Could not update scenes. ${updateError}`)

  if (inserts.length) {
    const { data: inserted, error } = await sb.from('scenes').insert(inserts.map((i) => i.values)).select('id, scene_number')
    if (error) throw new Error(`Could not add new scenes: ${error.message}`)
    for (const s of inserted || []) {
      const ins = inserts.find((i) => i.values.scene_number === s.scene_number)
      if (ins) castChanges.push({ sceneId: s.id, add: ins.addCast, remove: [] })
    }
    result.added = inserted?.length || 0
  }

  // 4. Locations follow the new sluglines (sequential: two scenes moving to one new location)
  for (const r of relocations) await relinkSceneLocation(sb, projectId, r.id, r.from, r.to)

  // 5. Speaking characters the user chose to add or remove
  for (const c of castChanges) await applyCastChanges(sb, projectId, c.sceneId, c.add, c.remove)

  // 6. The new draft is now the one the project follows
  await sb.from('script_documents').update({ is_current: false }).eq('project_id', projectId).neq('id', newDocumentId)
  await sb.from('script_documents').update({ is_current: true }).eq('id', newDocumentId)

  return { ...result, newDoc }
}

async function applyCastChanges(
  sb: Client,
  projectId: string,
  sceneId: string,
  add: string[],
  remove: string[]
) {
  if (!add.length && !remove.length) return
  const { data: existing } = await sb.from('scene_elements').select('*').eq('scene_id', sceneId).eq('element_type', 'CAST')
  const have = new Map((existing || []).map((e) => [e.name.toUpperCase(), e]))

  for (const name of remove) {
    const element = have.get(name)
    if (!element) continue
    await unlinkElement(sb, element.id)
    const { error } = await sb.from('scene_elements').delete().eq('id', element.id)
    if (error) throw new Error(`Could not remove ${name} from the breakdown: ${error.message}`)
  }

  const rows = add
    .filter((name) => !have.has(name))
    .map((name) => ({
      scene_id: sceneId,
      element_type: 'CAST' as const,
      name,
      description: 'Speaking character (from script)',
      confirm_status: 'CONFIRMED' as const,
      ai_confidence: 90,
    }))
  if (rows.length) {
    const { data: inserted, error } = await sb.from('scene_elements').insert(rows).select('*')
    if (error) throw new Error(`Could not add characters to the breakdown: ${error.message}`)
    for (const element of inserted || []) await reconcileElementLink(sb, projectId, element)
  }
}
