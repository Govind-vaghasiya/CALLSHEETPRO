/**
 * Keeps the project's scenes in step with the current script draft without breaking links.
 *
 * Scenes are matched by scene number and updated in place, so their ids — and with them the
 * breakdown, Cast & Crew links, and schedule placement — survive a new draft. Changed scenes are
 * flagged (is_changed + the draft's revision colour); scenes missing from the new draft are left
 * untouched and reported as omitted so nothing scheduled disappears silently.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, RevisionColor } from '@/types/database'
import type { ParsedScene } from './parser'
import { reconcileElementLink, syncProjectLinks } from '@/features/breakdown/lib/resource-links'
import { extractCharacterCues } from '@/features/characters/lib/character-cues'
import { forEachLimit } from '@/lib/async'

type Client = SupabaseClient<Database>

export interface SceneSyncSummary {
  added: number
  changed: number
  omitted: Array<{ sceneNumber: string; scheduled: boolean }>
}

const norm = (s: string | null | undefined) => (s || '').trim().toUpperCase()

/**
 * When a scene's slugline location changes, move its LOCATION breakdown element to the new
 * name and re-link it to the matching Cast & Crew location (creating one if needed).
 */
export async function relinkSceneLocation(
  sb: Client,
  projectId: string,
  sceneId: string,
  oldLocation: string | null,
  newLocation: string | null
) {
  if (norm(oldLocation) === norm(newLocation) || !norm(newLocation)) return
  const { data: elements } = await sb
    .from('scene_elements')
    .select('*')
    .eq('scene_id', sceneId)
    .eq('element_type', 'LOCATION')
  const target = (elements || []).find((e) => norm(e.name) === norm(oldLocation)) || elements?.[0]
  if (!target) return // syncProjectLinks will create it

  const { data: renamed } = await sb
    .from('scene_elements')
    .update({ name: norm(newLocation), updated_at: new Date().toISOString() })
    .eq('id', target.id)
    .select('*')
    .single()
  if (renamed) {
    // Re-point to the entry for the new name (never rename the old location — other scenes use it)
    await sb.from('scene_requirements').delete().eq('element_id', renamed.id)
    await reconcileElementLink(sb, projectId, renamed)
  }
}

export async function syncScenesFromDraft(
  sb: Client,
  projectId: string,
  documentId: string,
  parsed: ParsedScene[],
  revisionColor: RevisionColor
): Promise<SceneSyncSummary> {
  const { data: existing } = await sb.from('scenes').select('*').eq('project_id', projectId)
  const byNumber = new Map((existing || []).map((s) => [norm(s.scene_number), s]))
  const hadPreviousDraft = (existing || []).length > 0
  const seen = new Set<string>()
  const summary: SceneSyncSummary = { added: 0, changed: 0, omitted: [] }
  const sceneTexts = new Map<string, string>() // scene id → text, for character detection

  // One round trip per scene runs past a serverless time limit on a feature-length script,
  // so new scenes go in as one insert and updates run concurrently.
  const inserts: Database['public']['Tables']['scenes']['Insert'][] = []
  const updates: Array<{ id: string; values: Database['public']['Tables']['scenes']['Update'] }> = []
  const relocations: Array<{ id: string; from: string | null; to: string | null }> = []

  for (let idx = 0; idx < parsed.length; idx++) {
    const p = parsed[idx]
    const key = norm(p.sceneNumber)
    // scene_number is unique per project; a repeated number in the draft keeps its first scene
    if (seen.has(key)) continue
    seen.add(key)
    const fields = {
      script_document_id: documentId,
      scene_order: idx + 1,
      heading: p.heading,
      int_ext: p.intExt,
      location_name: p.locationName,
      time_of_day: p.timeOfDay,
      page_start: p.pageStart,
      page_end: p.pageEnd,
      description: p.description,
      estimated_duration: p.estimatedDuration,
      updated_at: new Date().toISOString(),
    }

    const prev = byNumber.get(key)
    if (!prev) {
      inserts.push({
        project_id: projectId,
        scene_number: p.sceneNumber,
        status: 'DETECTED',
        revision_color: revisionColor,
        is_changed: hadPreviousDraft,
        ...fields,
      })
      continue
    }
    sceneTexts.set(prev.id, p.description || '')

    const changed =
      norm(prev.heading) !== norm(p.heading) || (prev.description || '').trim() !== (p.description || '').trim()
    // Breakdown status is kept; a changed scene is flagged for re-review instead of reset
    updates.push({
      id: prev.id,
      values: { ...fields, is_changed: changed, revision_color: changed ? revisionColor : prev.revision_color },
    })
    if (changed) summary.changed++
    relocations.push({ id: prev.id, from: prev.location_name, to: p.locationName })
  }

  if (inserts.length > 0) {
    const { data: inserted, error } = await sb.from('scenes').insert(inserts).select('id, description')
    if (error) throw new Error(`Could not save scenes: ${error.message}`)
    for (const s of inserted || []) sceneTexts.set(s.id, s.description || '')
    summary.added = inserted?.length || 0
  }
  await forEachLimit(updates, 10, (u) => sb.from('scenes').update(u.values).eq('id', u.id))
  // Sequential: two scenes moving to the same new location must not both create it
  for (const r of relocations) await relinkSceneLocation(sb, projectId, r.id, r.from, r.to)

  // Scenes not in this draft: keep them (they may be scheduled) and report them
  const omitted = (existing || []).filter((s) => !seen.has(norm(s.scene_number)))
  if (omitted.length > 0) {
    const { data: placed } = await sb
      .from('shoot_day_scenes')
      .select('scene_id')
      .in(
        'scene_id',
        omitted.map((s) => s.id)
      )
    const scheduled = new Set((placed || []).map((p) => p.scene_id))
    summary.omitted = omitted.map((s) => ({ sceneNumber: s.scene_number, scheduled: scheduled.has(s.id) }))
  }

  await addSpeakingCharacters(sb, sceneTexts)
  await syncProjectLinks(sb, projectId)
  return summary
}

/** One-line note stored on the draft so the change summary is visible in the Scripts list. */
export function describeSync(summary: SceneSyncSummary): string {
  const parts = [`${summary.added} new`, `${summary.changed} changed`]
  if (summary.omitted.length > 0) {
    const scheduled = summary.omitted.filter((o) => o.scheduled).map((o) => o.sceneNumber)
    parts.push(
      `${summary.omitted.length} omitted (${summary.omitted.map((o) => o.sceneNumber).join(', ')})` +
        (scheduled.length ? ` — still scheduled: ${scheduled.join(', ')}` : '')
    )
  }
  return `Scene sync: ${parts.join(', ')}.`
}

/**
 * Speaking characters found in each scene's text become confirmed CAST breakdown items
 * (skipping ones already tagged). syncProjectLinks then links them to characters.
 */
async function addSpeakingCharacters(sb: Client, sceneTexts: Map<string, string>) {
  const sceneIds = Array.from(sceneTexts.keys())
  for (let i = 0; i < sceneIds.length; i += 150) {
    const ids = sceneIds.slice(i, i + 150)
    const { data: existing } = await sb.from('scene_elements').select('scene_id, name').eq('element_type', 'CAST').in('scene_id', ids)
    const have = new Set((existing || []).map((e) => `${e.scene_id}:${e.name.toUpperCase()}`))
    const rows = ids.flatMap((sceneId) =>
      extractCharacterCues(sceneTexts.get(sceneId))
        .filter((name) => !have.has(`${sceneId}:${name}`))
        .map((name) => ({
          scene_id: sceneId,
          element_type: 'CAST' as const,
          name,
          description: 'Speaking character (from script)',
          confirm_status: 'CONFIRMED' as const,
          ai_confidence: 90,
        }))
    )
    if (rows.length) await sb.from('scene_elements').insert(rows)
  }
}
