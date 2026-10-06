/**
 * A past or not-yet-applied draft's scenes, read from its own pages for reading (never saved).
 * The project's scenes follow the current draft only; other drafts are shown as written.
 */
import type { ScriptDocumentWithStats, ScriptPageItem, ScriptSceneItem } from '../actions'
import { extractScenesFromPages } from './parser'
import { cleanSceneHeading } from '@/features/breakdown/lib/one-liners'

const norm = (s: string | null | undefined) => (s || '').trim().toUpperCase()

export function draftScenesFromPages(
  script: ScriptDocumentWithStats,
  pages: ScriptPageItem[],
  projectScenes: ScriptSceneItem[]
): ScriptSceneItem[] {
  const parsed = extractScenesFromPages(pages.map((p) => ({ pageNumber: p.page_number, rawText: p.raw_text || '' })))
  const byNumber = new Map(projectScenes.map((s) => [norm(s.scene_number), s]))
  const seen = new Set<string>()
  const scenes: ScriptSceneItem[] = []
  for (const p of parsed) {
    const key = norm(p.sceneNumber)
    if (seen.has(key)) continue // scene numbers are unique, as in scene sync
    seen.add(key)
    // The app's one-liner, when the app has this same scene
    const match = byNumber.get(key)
    const same = match && norm(cleanSceneHeading(match.heading)) === norm(p.heading)
    scenes.push({
      id: `draft-${script.id}-${scenes.length}`,
      project_id: script.project_id,
      script_document_id: script.id,
      scene_number: p.sceneNumber,
      scene_order: scenes.length + 1,
      heading: p.heading,
      int_ext: p.intExt,
      location_name: p.locationName,
      time_of_day: p.timeOfDay,
      page_start: p.pageStart,
      page_end: p.pageEnd,
      description: p.description,
      estimated_duration: p.estimatedDuration,
      synopsis: same ? (match.synopsis ?? null) : null,
      synopsis_source: same ? (match.synopsis_source ?? null) : null,
      page_eighths: p.pageEighths,
      time_of_day_label: p.timeLabel,
      episode_number: null,
      status: 'DETECTED',
      ai_confidence: null,
      revision_color: script.revision_color,
      is_changed: false,
      created_at: script.created_at,
    })
  }
  return scenes
}
