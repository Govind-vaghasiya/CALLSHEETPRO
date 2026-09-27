import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { SceneSearchExtras } from './scene-search'

/**
 * Per-scene breakdown text for search: element names (characters, props…), linked actor names,
 * tags, and notes. Loaded in one pass for the whole project.
 */
export async function loadSceneSearchIndex(
  sb: SupabaseClient<Database>,
  projectId: string
): Promise<Map<string, SceneSearchExtras>> {
  const index = new Map<string, SceneSearchExtras>()
  const { data: scenes } = await sb.from('scenes').select('id').eq('project_id', projectId)
  const sceneIds = (scenes || []).map((s) => s.id)
  if (sceneIds.length === 0) return index

  const entry = (id: string) => {
    let e = index.get(id)
    if (!e) {
      e = { elements: [], people: [], tags: [], notes: [] }
      index.set(id, e)
    }
    return e
  }

  // Chunk the id list so very large scripts stay under URL limits
  const chunks: string[][] = []
  for (let i = 0; i < sceneIds.length; i += 150) chunks.push(sceneIds.slice(i, i + 150))

  await Promise.all(
    chunks.map(async (ids) => {
      const [{ data: elements }, { data: links }, { data: tags }, { data: notes }] = await Promise.all([
        sb.from('scene_elements').select('scene_id, name, confirm_status').in('scene_id', ids),
        sb.from('scene_requirements').select('scene_id, resources(name, display_name)').in('scene_id', ids),
        sb.from('scene_tags').select('scene_id, label').in('scene_id', ids),
        sb.from('scene_notes').select('scene_id, note').in('scene_id', ids),
      ])
      for (const e of elements || []) if (e.confirm_status !== 'REMOVED') entry(e.scene_id).elements.push(e.name)
      for (const l of links || []) {
        const r = l.resources as unknown as { name: string; display_name: string | null } | null
        if (r) entry(l.scene_id).people.push(...[r.name, r.display_name].filter((v): v is string => !!v && v !== 'TBC'))
      }
      for (const t of tags || []) entry(t.scene_id).tags.push(t.label)
      for (const n of notes || []) entry(n.scene_id).notes.push(n.note)
    })
  )
  return index
}
