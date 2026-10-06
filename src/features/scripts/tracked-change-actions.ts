'use server'

/**
 * Accepting or rejecting the changes a merged draft brought into the master script.
 * A scene with unreviewed changes keeps its last confirmed text in accepted_heading /
 * accepted_description (migration 025); accepting clears it, rejecting puts it back.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import { parseSlugline } from './lib/slugline'
import { relinkSceneLocation } from './lib/scene-sync'

const CLEARED = { accepted_heading: null, accepted_description: null, changes_from_document_id: null }

function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/scripts`, 'layout')
  revalidatePath(`/projects/${projectId}/breakdown`)
  revalidatePath(`/projects/${projectId}/schedule`)
}

/** Accept: the highlighted text becomes final. No ids = every scene with changes to review. */
export async function acceptSceneChangesAction(projectId: string, sceneIds?: string[]): Promise<{ error?: string; accepted?: number }> {
  const sb = await createClient()
  let query = sb.from('scenes').update(CLEARED).eq('project_id', projectId).not('accepted_description', 'is', null)
  if (sceneIds) query = query.in('id', sceneIds)
  const { data, error } = await query.select('id')
  if (error) return { error: `Could not accept the changes: ${error.message}` }
  refresh(projectId)
  return { accepted: data?.length ?? 0 }
}

/**
 * Reject: the scene goes back to its last confirmed text. A scene the draft added is removed
 * (with its breakdown), since there is no earlier version to go back to.
 */
export async function rejectSceneChangesAction(projectId: string, sceneId: string): Promise<{ error?: string; removed?: boolean }> {
  const sb = await createClient()
  const { data: scene, error } = await sb.from('scenes').select('*').eq('id', sceneId).eq('project_id', projectId).single()
  if (error || !scene) return { error: 'That scene could not be found.' }
  if (scene.accepted_description === null || scene.accepted_description === undefined) return {}

  if (scene.accepted_description === '' && !scene.accepted_heading) {
    const { error: delError } = await sb.from('scenes').delete().eq('id', sceneId)
    if (delError) return { error: `Could not remove the new scene: ${delError.message}` }
    await syncProjectBookings(sb, projectId)
    refresh(projectId)
    return { removed: true }
  }

  const heading = scene.accepted_heading || scene.heading || ''
  const slug = parseSlugline(heading)
  const { error: upError } = await sb
    .from('scenes')
    .update({
      heading,
      description: scene.accepted_description,
      ...(slug ? { int_ext: slug.intExt, location_name: slug.locationName, time_of_day: slug.timeOfDay } : {}),
      ...CLEARED,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sceneId)
  if (upError) return { error: `Could not restore the scene: ${upError.message}` }
  if (slug && slug.locationName !== scene.location_name) {
    await relinkSceneLocation(sb, projectId, sceneId, scene.location_name, slug.locationName)
    await syncProjectBookings(sb, projectId)
  }
  refresh(projectId)
  return {}
}
