import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ResourceType, SceneElementType } from '@/types/database'

type SceneRow = Database['public']['Tables']['scenes']['Row']

export interface SceneDetail {
  scene: SceneRow
  scriptName: string | null
  schedule: { dayId: string; dayNumber: number | null; shootDate: string; callTime: string | null } | null
  elements: Array<{
    id: string
    type: SceneElementType
    name: string
    confirmed: boolean
    resource: { id: string; name: string; displayName: string | null; type: ResourceType } | null
  }>
  tags: Array<{ id: string; label: string }>
  notes: Array<{ id: string; note: string; createdAt: string }>
}

/** Everything the scene detail popup shows, in one round of queries (works with any client). */
export async function loadSceneDetail(sb: SupabaseClient<Database>, sceneId: string): Promise<SceneDetail | null> {
  const { data: scene } = await sb.from('scenes').select('*').eq('id', sceneId).single()
  if (!scene) return null

  const [{ data: doc }, { data: placement }, { data: elements }, { data: links }, { data: tags }, { data: notes }] =
    await Promise.all([
      scene.script_document_id
        ? sb.from('script_documents').select('file_name, version').eq('id', scene.script_document_id).maybeSingle()
        : Promise.resolve({ data: null }),
      sb
        .from('shoot_day_scenes')
        .select('shoot_day_id, shoot_days(day_number, shoot_date, call_time)')
        .eq('scene_id', sceneId)
        .maybeSingle(),
      sb.from('scene_elements').select('*').eq('scene_id', sceneId).order('name', { ascending: true }),
      sb
        .from('scene_requirements')
        .select('element_id, resources(id, name, display_name, resource_type)')
        .eq('scene_id', sceneId),
      sb.from('scene_tags').select('id, label').eq('scene_id', sceneId),
      sb.from('scene_notes').select('id, note, created_at').eq('scene_id', sceneId).order('created_at', { ascending: false }),
    ])

  const day = placement?.shoot_days as unknown as { day_number: number | null; shoot_date: string; call_time: string | null } | null
  const resourceByElement = new Map(
    (links || []).map((l) => [
      l.element_id,
      l.resources as unknown as { id: string; name: string; display_name: string | null; resource_type: ResourceType } | null,
    ])
  )

  return {
    scene,
    scriptName: doc ? `${doc.file_name} (v${doc.version})` : null,
    schedule:
      placement && day
        ? { dayId: placement.shoot_day_id, dayNumber: day.day_number, shootDate: day.shoot_date, callTime: day.call_time }
        : null,
    elements: (elements || [])
      .filter((e) => e.confirm_status !== 'REMOVED')
      .map((e) => {
        const r = resourceByElement.get(e.id)
        return {
          id: e.id,
          type: e.element_type,
          name: e.name,
          confirmed: e.confirm_status === 'CONFIRMED' || e.confirm_status === 'EDITED',
          resource: r ? { id: r.id, name: r.name, displayName: r.display_name, type: r.resource_type } : null,
        }
      }),
    tags: (tags || []).map((t) => ({ id: t.id, label: t.label })),
    notes: (notes || []).map((n) => ({ id: n.id, note: n.note, createdAt: n.created_at })),
  }
}
