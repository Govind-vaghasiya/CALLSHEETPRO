'use server'

/**
 * Draft comparison and applying a new draft's changes scene by scene.
 *
 * The browser and the server build the same rows from the same inputs (see lib/draft-compare.ts):
 * the browser to show them, the server to apply exactly the rows the user picked, with the
 * pairings the user set.
 */
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { recordActivity } from '@/features/collaboration/lib/activity'
import type { Draft, PairOverrides, ProjectSceneState, RowDecision } from './lib/draft-compare'
import { applyDraftChanges, loadDraft, loadProjectScenes, type ApplyDraftResult } from './lib/draft-apply'

export async function getDraftForCompareAction(projectId: string, documentId: string): Promise<{ error: string } | { draft: Draft }> {
  try {
    const sb = await createClient()
    const { data: doc } = await sb.from('script_documents').select('project_id').eq('id', documentId).single()
    if (!doc || doc.project_id !== projectId) return { error: 'That draft could not be found.' }
    const draft = await loadDraft(sb, documentId)
    if (!draft) return { error: 'This draft has no readable pages.' }
    return { draft }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not read the draft.' }
  }
}

export async function getProjectSceneStateAction(projectId: string): Promise<{ error: string } | { scenes: ProjectSceneState[] }> {
  try {
    const sb = await createClient()
    return { scenes: await loadProjectScenes(sb, projectId) }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not read the project scenes.' }
  }
}

/** Apply the picked rows; the caller then links new breakdown items (linkUploadedScriptAction). */
export async function applyDraftChangesAction(
  projectId: string,
  oldDocumentId: string,
  newDocumentId: string,
  overrides: PairOverrides,
  decisions: RowDecision[]
): Promise<{ error: string } | ApplyDraftResult> {
  try {
    const sb = await createClient()
    const { data: allowed } = await sb.rpc('can_modify_project', { proj_id: projectId })
    if (!allowed) return { error: 'You do not have permission to change scripts in this production.' }

    const { newDoc, ...result } = await applyDraftChanges(sb, projectId, oldDocumentId, newDocumentId, overrides, decisions)

    const parts = [
      result.updated && `${result.updated} updated`,
      result.added && `${result.added} added`,
      result.deleted && `${result.deleted} deleted`,
    ].filter(Boolean)
    if (parts.length) {
      await recordActivity(projectId, 'DRAFT_CHANGED', `Applied changes from ${newDoc.file_name} (v${newDoc.version})`, `Scenes: ${parts.join(', ')}`)
    }

    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/projects/${projectId}/scripts`)
    revalidatePath(`/projects/${projectId}/scripts/${newDocumentId}`)
    revalidatePath(`/projects/${projectId}/breakdown`)
    revalidatePath(`/projects/${projectId}/schedule`)
    return result
  } catch (err) {
    console.error('Apply draft changes error:', err)
    return { error: err instanceof Error ? err.message : 'Could not apply the changes.' }
  }
}
