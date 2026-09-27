'use server'

import { redirect } from 'next/navigation'
import { notifyProjectMembers, recordActivity } from '@/features/collaboration/lib/activity'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseScreenplayBuffer, extractScenesFromPages } from './lib/parser'
import { describeSync, relinkSceneLocation, syncScenesFromDraft } from './lib/scene-sync'
import { syncProjectBookings } from '@/features/breakdown/lib/resource-links'
import { parseSlugline } from './lib/slugline'
import type {
  RevisionColor,
  ScriptStatus,
  ScriptFileType,
  SceneStatus,
  IntExt,
  TimeOfDay,
} from '@/types/database'

export interface ScriptDocumentWithStats {
  id: string
  project_id: string
  file_name: string
  storage_path: string
  file_type: ScriptFileType
  file_size_bytes: number | null
  status: ScriptStatus
  version: number
  revision_color: RevisionColor
  revision_date: string | null
  revision_notes: string | null
  is_current: boolean
  total_pages: number | null
  total_scenes: number | null
  uploaded_by: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

export interface ScriptSceneItem {
  id: string
  project_id: string
  script_document_id: string | null
  scene_number: string
  scene_order: number | null
  heading: string | null
  int_ext: IntExt | null
  location_name: string | null
  time_of_day: TimeOfDay | null
  page_start: number | null
  page_end: number | null
  description: string | null
  estimated_duration: number | null
  episode_number: string | null
  status: SceneStatus
  ai_confidence: number | null
  revision_color: RevisionColor | null
  is_changed: boolean
  created_at: string
}

export interface ScriptPageItem {
  id: string
  script_document_id: string
  page_number: number
  raw_text: string | null
  created_at: string
}

export type ScriptActionState = {
  error?: string
  success?: string
}

const SCRIPTS_BUCKET = 'scripts'

/**
 * The admin key is only used for Storage and script_pages (which has no write policy).
 * Every such use is preceded by this check so a user can only touch projects they may edit.
 */
async function assertCanModifyProject(projectId: string) {
  const supabase = await createClient()
  const { data: allowed, error } = await supabase.rpc('can_modify_project', { proj_id: projectId })
  if (error || !allowed) throw new Error('You do not have permission to change scripts in this production.')
}

async function ensureScriptsBucket() {
  const admin = createAdminClient()
  const { data: buckets } = await admin.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === SCRIPTS_BUCKET)
  if (!exists) {
    await admin.storage.createBucket(SCRIPTS_BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
    })
  }
}

/**
 * Fetch all scripts for a project ordered by version desc
 */
export async function getProjectScripts(projectId: string): Promise<ScriptDocumentWithStats[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('script_documents')
    .select('*')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching project scripts:', error)
    return []
  }

  return (data as ScriptDocumentWithStats[]) || []
}

/**
 * Fetch script by ID
 */
export async function getScriptById(scriptId: string): Promise<ScriptDocumentWithStats | null> {
  const db = await createClient()
  const { data, error } = await db
    .from('script_documents')
    .select('*')
    .eq('id', scriptId)
    .single()

  if (error || !data) return null
  return data as ScriptDocumentWithStats
}

/**
 * Fetch detected scenes for a script
 */
export async function getScriptScenes(scriptId: string): Promise<ScriptSceneItem[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('scenes')
    .select('*')
    .eq('script_document_id', scriptId)
    .order('scene_order', { ascending: true })

  if (error) {
    console.error('Error fetching script scenes:', error)
    return []
  }

  return (data as ScriptSceneItem[]) || []
}

/**
 * All scenes in a project (the project has one scene list; drafts only revise it)
 */
export async function getProjectScenes(projectId: string): Promise<ScriptSceneItem[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('scenes')
    .select('*')
    .eq('project_id', projectId)
    .order('scene_order', { ascending: true })

  if (error) {
    console.error('Error fetching project scenes:', error)
    return []
  }
  return (data as ScriptSceneItem[]) || []
}

/**
 * Fetch extracted pages for a script
 */
export async function getScriptPages(scriptId: string): Promise<ScriptPageItem[]> {
  const db = await createClient()
  const { data, error } = await db
    .from('script_pages')
    .select('*')
    .eq('script_document_id', scriptId)
    .order('page_number', { ascending: true })

  if (error) {
    console.error('Error fetching script pages:', error)
    return []
  }

  return (data as ScriptPageItem[]) || []
}

/**
 * Upload screenplay file, extract pages & sluglines, and record draft
 */
export async function uploadScriptAction(
  projectId: string,
  _prevState: ScriptActionState | null,
  formData: FormData
): Promise<ScriptActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return { error: 'Please select a screenplay file to upload (.pdf, .fdx, .txt, .fountain).' }
  }

  const fileName = file.name
  const lowerName = fileName.toLowerCase()
  const validExtensions = ['.pdf', '.fdx', '.txt', '.fountain']
  if (!validExtensions.some((ext) => lowerName.endsWith(ext))) {
    return { error: 'Unsupported file type. Supported formats are: PDF, Final Draft (.fdx), Fountain, and Text.' }
  }

  const versionRaw = formData.get('version') as string
  const version = versionRaw && !isNaN(Number(versionRaw)) && Number(versionRaw) > 0 ? Number(versionRaw) : 1
  const revisionColor = (formData.get('revisionColor') as RevisionColor) || 'WHITE'
  const revisionDate = (formData.get('revisionDate') as string) || new Date().toISOString().slice(0, 10)
  const revisionNotes = (formData.get('revisionNotes') as string) || null
  const isCurrent = formData.get('isCurrent') === 'true'

  try {
    // Storage and script_pages need the admin key; check permission first
    await assertCanModifyProject(projectId)
    await ensureScriptsBucket()
    const admin = createAdminClient()

    // 1. Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 2. Parse screenplay (pages, scene headings, INT/EXT, etc.)
    const parseResult = await parseScreenplayBuffer(fileName, buffer)

    // 3. Upload raw file to Supabase Storage
    const documentId = crypto.randomUUID()
    const storagePath = `${projectId}/${documentId}/${fileName}`

    const { error: uploadError } = await admin.storage
      .from(SCRIPTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return { error: `Failed to upload file to storage: ${uploadError.message}` }
    }

    // 4. A draft only takes over the project's scenes when it becomes current
    //    (or when there is no current draft yet)
    const { data: currentDocs } = await supabase
      .from('script_documents')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_current', true)
    const becomesCurrent = isCurrent || (currentDocs || []).length === 0

    if (becomesCurrent) {
      await supabase
        .from('script_documents')
        .update({ is_current: false })
        .eq('project_id', projectId)
    }

    // 5. Insert script_documents record
    const { data: insertedDoc, error: docError } = await supabase
      .from('script_documents')
      .insert({
        id: documentId,
        project_id: projectId,
        file_name: fileName,
        storage_path: storagePath,
        file_type: parseResult.fileType,
        file_size_bytes: file.size,
        status: 'PROCESSED',
        version,
        revision_color: revisionColor,
        revision_date: revisionDate,
        revision_notes: revisionNotes,
        is_current: becomesCurrent,
        total_pages: parseResult.totalPages,
        total_scenes: parseResult.scenes.length,
        uploaded_by: user.id,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (docError || !insertedDoc) {
      console.error('Database doc insertion error:', docError)
      return { error: `Database error: ${docError?.message || 'Failed to save script'}` }
    }

    // 6. Bulk insert script_pages (in batches of 50)
    if (parseResult.pages.length > 0) {
      const pageRows = parseResult.pages.map((p) => ({
        script_document_id: documentId,
        page_number: p.pageNumber,
        raw_text: (p.rawText || '').replace(/\0/g, ''),
      }))

      for (let i = 0; i < pageRows.length; i += 50) {
        const batch = pageRows.slice(i, i + 50)
        const { error: pageInsertError } = await admin.from('script_pages').insert(batch)
        if (pageInsertError) {
          console.error('Error inserting script_pages batch:', pageInsertError)
        }
      }
    }

    // 7. Update the project's scenes in place (ids, breakdown, and schedule placement survive)
    if (becomesCurrent && parseResult.scenes.length > 0) {
      const summary = await syncScenesFromDraft(supabase, projectId, documentId, parseResult.scenes, revisionColor)
      await supabase
        .from('script_documents')
        .update({ revision_notes: [revisionNotes, describeSync(summary)].filter(Boolean).join('\n') })
        .eq('id', documentId)
    }

    await recordActivity(projectId, 'SCRIPT_UPLOADED', `Uploaded ${fileName} (v${version})`, becomesCurrent ? 'Now the current draft' : undefined)
    await notifyProjectMembers(
      projectId,
      'SCRIPT_REVISION_UPLOADED',
      `New script draft: ${fileName}`,
      `Version ${version}${becomesCurrent ? ' is now the current draft.' : '.'}`,
      `/projects/${projectId}/scripts`
    )

    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/projects/${projectId}/scripts`)
    revalidatePath(`/projects/${projectId}/scripts/${documentId}`)
  } catch (err: any) {
    console.error('Unhandled script upload error:', err)
    return { error: err?.message || 'An unexpected error occurred during screenplay processing.' }
  }

  redirect(`/projects/${projectId}/scripts`)
}

/**
 * Set a script as the active current draft
 */
export async function makeScriptCurrentAction(scriptId: string, projectId: string): Promise<void> {
  const supabase = await createClient()

  const { data: doc } = await supabase.from('script_documents').select('*').eq('id', scriptId).single()
  if (!doc) return

  await supabase.from('script_documents').update({ is_current: false }).eq('project_id', projectId)
  await supabase.from('script_documents').update({ is_current: true }).eq('id', scriptId)

  // The project's scenes now follow this draft
  const { data: pages } = await supabase
    .from('script_pages')
    .select('page_number, raw_text')
    .eq('script_document_id', scriptId)
    .order('page_number', { ascending: true })
  const parsed = extractScenesFromPages((pages || []).map((p) => ({ pageNumber: p.page_number, rawText: p.raw_text || '' })))
  if (parsed.length > 0) {
    const summary = await syncScenesFromDraft(supabase, projectId, scriptId, parsed, doc.revision_color)
    await supabase
      .from('script_documents')
      .update({ revision_notes: [doc.revision_notes, describeSync(summary)].filter(Boolean).join('\n') })
      .eq('id', scriptId)
  }

  await recordActivity(projectId, 'DRAFT_CHANGED', `Made ${doc.file_name} (v${doc.version}) the current draft`)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/scripts`)
  revalidatePath(`/projects/${projectId}/breakdown`)
  revalidatePath(`/projects/${projectId}/schedule`)
}

export interface ScriptDeleteImpact {
  isCurrent: boolean
  otherDraftCount: number
  sceneCount: number
  scheduledSceneCount: number
  taggedElementCount: number
}

/** What deleting a draft would affect, shown in the confirmation dialog. */
export async function getScriptDeleteImpactAction(scriptId: string): Promise<ScriptDeleteImpact | null> {
  const supabase = await createClient()
  const { data: doc } = await supabase.from('script_documents').select('project_id, is_current').eq('id', scriptId).single()
  if (!doc) return null

  const [{ count: otherDraftCount }, { data: scenes }] = await Promise.all([
    supabase
      .from('script_documents')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', doc.project_id)
      .neq('id', scriptId),
    supabase.from('scenes').select('id').eq('script_document_id', scriptId),
  ])
  const sceneIds = (scenes || []).map((s) => s.id)
  const [{ count: scheduled }, { count: tagged }] = sceneIds.length
    ? await Promise.all([
        supabase.from('shoot_day_scenes').select('id', { count: 'exact', head: true }).in('scene_id', sceneIds),
        supabase.from('scene_elements').select('id', { count: 'exact', head: true }).in('scene_id', sceneIds),
      ])
    : [{ count: 0 }, { count: 0 }]

  return {
    isCurrent: doc.is_current,
    otherDraftCount: otherDraftCount || 0,
    sceneCount: sceneIds.length,
    scheduledSceneCount: scheduled || 0,
    taggedElementCount: tagged || 0,
  }
}

/**
 * Delete a script draft and its file/pages.
 * Scenes are production data: they are kept (and handed to the next most recent draft when the
 * current draft is deleted) unless the caller explicitly asks to delete them too.
 */
export async function deleteScriptAction(
  scriptId: string,
  projectId: string,
  options: { deleteScenes?: boolean } = {}
): Promise<void> {
  await assertCanModifyProject(projectId)
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: doc } = await supabase
    .from('script_documents')
    .select('storage_path, is_current, project_id')
    .eq('id', scriptId)
    .single()
  if (!doc || doc.project_id !== projectId) return

  if (options.deleteScenes) {
    // Explicit request: remove this draft's scenes (their breakdown and schedule placement go too)
    await supabase.from('scenes').delete().eq('script_document_id', scriptId)
  } else if (doc.is_current) {
    // Fall back to the previous draft so the scenes keep a current script
    const { data: previous } = await supabase
      .from('script_documents')
      .select('id')
      .eq('project_id', projectId)
      .neq('id', scriptId)
      .order('version', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
    if (previous?.[0]) await makeScriptCurrentAction(previous[0].id, projectId)
  }

  if (doc.storage_path) {
    await admin.storage.from(SCRIPTS_BUCKET).remove([doc.storage_path])
  }
  await admin.from('script_pages').delete().eq('script_document_id', scriptId)
  // Remaining scenes keep existing with script_document_id → null (FK on delete set null)
  await supabase.from('script_documents').delete().eq('id', scriptId)
  await syncProjectBookings(supabase, projectId)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/scripts`)
  revalidatePath(`/projects/${projectId}/breakdown`)
  revalidatePath(`/projects/${projectId}/schedule`)
  redirect(`/projects/${projectId}/scripts`)
}

/**
 * Update a scene's number (e.g. rename to 4A, 10B, etc.)
 */
export async function updateSceneNumberAction(
  sceneId: string,
  newSceneNumber: string,
  projectId: string,
  scriptId: string
): Promise<{ success?: boolean; error?: string }> {
  const db = await createClient()
  const trimmed = newSceneNumber.trim().toUpperCase()
  if (!trimmed) return { error: 'Scene number cannot be empty' }

  const { error } = await db
    .from('scenes')
    .update({ scene_number: trimmed })
    .eq('id', sceneId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/scripts/${scriptId}`)
  return { success: true }
}

/**
 * Add a sub-scene (e.g. 4A under 4)
 */
export async function addSubSceneAction(
  parentSceneId: string,
  projectId: string,
  scriptId: string
): Promise<{ success?: boolean; newSceneId?: string; error?: string }> {
  const db = await createClient()

  const { data: parent } = await db
    .from('scenes')
    .select('*')
    .eq('id', parentSceneId)
    .single()

  if (!parent) return { error: 'Parent scene not found' }

  // Determine subscene number: e.g. parent is "4", look for "4A", "4B", etc.
  const parentNum = parent.scene_number.replace(/[A-Z]+$/i, '')
  const { data: siblings } = await db
    .from('scenes')
    .select('scene_number, scene_order')
    .eq('script_document_id', scriptId)
    .ilike('scene_number', `${parentNum}%`)

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let nextLetter = 'A'
  if (siblings && siblings.length > 0) {
    const existingLetters = siblings
      .map((s) => s.scene_number.replace(parentNum, '').toUpperCase())
      .filter((l) => l.length === 1 && letters.includes(l))

    for (const char of letters) {
      if (!existingLetters.includes(char)) {
        nextLetter = char
        break
      }
    }
  }

  const newSceneNumber = `${parentNum}${nextLetter}`
  const newSceneOrder = (parent.scene_order || 0) + 1

  const newScene = {
    project_id: projectId,
    script_document_id: scriptId,
    scene_number: newSceneNumber,
    scene_order: newSceneOrder,
    heading: `${parent.heading || 'SCENE'} (PART ${nextLetter})`,
    int_ext: parent.int_ext || 'INT',
    location_name: parent.location_name || 'UNSPECIFIED LOCATION',
    time_of_day: parent.time_of_day || 'DAY',
    page_start: parent.page_start || 1,
    page_end: parent.page_end || 1,
    description: `Sub-scene ${newSceneNumber} created from Scene ${parent.scene_number}.\n\n`,
    estimated_duration: 30,
    status: 'DETECTED' as SceneStatus,
  }

  const { data: inserted, error } = await db
    .from('scenes')
    .insert(newScene)
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/scripts/${scriptId}`)
  return { success: true, newSceneId: inserted?.id }
}

export interface CreateSceneInput {
  projectId: string
  scriptId: string
  sceneNumber: string
  intExt: IntExt
  locationName: string
  timeOfDay: TimeOfDay
  heading?: string
  description?: string
  pageStart?: number
  pageEnd?: number
  estimatedDuration?: number // in seconds
}

/**
 * Manually create a new scene in a script draft
 */
export async function createSceneAction(
  input: CreateSceneInput
): Promise<{ success?: boolean; scene?: ScriptSceneItem; error?: string }> {
  const db = await createClient()

  const sceneNumber = input.sceneNumber.trim().toUpperCase()
  if (!sceneNumber) return { error: 'Scene number is required' }

  const locationName = input.locationName.trim().toUpperCase() || 'UNSPECIFIED LOCATION'
  const intExt = input.intExt || 'INT'
  const timeOfDay = input.timeOfDay || 'DAY'
  const heading =
    input.heading?.trim().toUpperCase() || `${intExt}. ${locationName} - ${timeOfDay}`

  // Get max scene_order
  const { data: lastScene } = await db
    .from('scenes')
    .select('scene_order')
    .eq('script_document_id', input.scriptId)
    .order('scene_order', { ascending: false })
    .limit(1)

  const maxOrder = lastScene && lastScene.length > 0 ? (lastScene[0].scene_order || 0) : 0
  const nextOrder = maxOrder + 1

  const newSceneRecord = {
    project_id: input.projectId,
    script_document_id: input.scriptId,
    scene_number: sceneNumber,
    scene_order: nextOrder,
    heading,
    int_ext: intExt,
    location_name: locationName,
    time_of_day: timeOfDay,
    page_start: input.pageStart || 1,
    page_end: input.pageEnd || input.pageStart || 1,
    description: input.description?.trim() || `${heading}\n\n`,
    estimated_duration: input.estimatedDuration || 60,
    status: 'DETECTED' as SceneStatus,
    revision_color: 'WHITE' as RevisionColor,
    is_changed: false,
  }

  const { data: inserted, error } = await db
    .from('scenes')
    .insert(newSceneRecord)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to create scene:', error)
    return { error: error.message }
  }

  // Update total_scenes count on script_document
  const { count } = await db
    .from('scenes')
    .select('*', { count: 'exact', head: true })
    .eq('script_document_id', input.scriptId)

  if (count !== null) {
    await db
      .from('script_documents')
      .update({ total_scenes: count })
      .eq('id', input.scriptId)
  }

  revalidatePath(`/projects/${input.projectId}`)
  revalidatePath(`/projects/${input.projectId}/scripts`)
  revalidatePath(`/projects/${input.projectId}/scripts/${input.scriptId}`)

  return { success: true, scene: inserted as ScriptSceneItem }
}

/**
 * Reorder a scene (UP or DOWN)
 */
export async function reorderSceneAction(
  sceneId: string,
  direction: 'UP' | 'DOWN',
  projectId: string,
  scriptId: string
): Promise<{ success?: boolean; error?: string }> {
  const db = await createClient()

  const { data: scenes } = await db
    .from('scenes')
    .select('id, scene_order, scene_number')
    .eq('script_document_id', scriptId)
    .order('scene_order', { ascending: true })

  if (!scenes) return { error: 'No scenes found' }

  const currentIndex = scenes.findIndex((s) => s.id === sceneId)
  if (currentIndex === -1) return { error: 'Scene not found' }

  const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= scenes.length) return { success: true }

  const current = scenes[currentIndex]
  const target = scenes[targetIndex]

  const currentOrder = current.scene_order ?? currentIndex
  const targetOrder = target.scene_order ?? targetIndex

  await db.from('scenes').update({ scene_order: targetOrder }).eq('id', current.id)
  await db.from('scenes').update({ scene_order: currentOrder }).eq('id', target.id)

  revalidatePath(`/projects/${projectId}/scripts/${scriptId}`)
  return { success: true }
}

/**
 * Renumber all scenes sequentially (1, 2, 3...)
 * Uses chunked concurrent updates for instant completion even with 150+ scenes.
 */
export async function renumberAllScenesAction(
  scriptId: string,
  projectId: string
): Promise<{ success?: boolean; renumberedCount?: number; error?: string }> {
  const db = await createClient()

  const { data: scenes } = await db
    .from('scenes')
    .select('id, scene_number, scene_order')
    .eq('script_document_id', scriptId)
    .order('scene_order', { ascending: true })

  if (!scenes || scenes.length === 0) return { error: 'No scenes to renumber' }

  // Batch updates in concurrent chunks of 25 for rapid completion (< 400ms)
  const updates = scenes.map((s, i) => ({
    id: s.id,
    scene_number: String(i + 1),
    scene_order: i + 1,
  }))

  const chunkSize = 25
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize)
    await Promise.all(
      chunk.map((item) =>
        db
          .from('scenes')
          .update({
            scene_number: item.scene_number,
            scene_order: item.scene_order,
          })
          .eq('id', item.id)
      )
    )
  }

  revalidatePath(`/projects/${projectId}/scripts/${scriptId}`)
  return { success: true, renumberedCount: updates.length }
}

/**
 * Batch update scene orders after drag and drop
 */
export async function updateScenesOrderBatchAction(
  orderedSceneIds: string[],
  scriptId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const db = await createClient()

  // Update scene_order for each scene
  const updates = orderedSceneIds.map((id, index) =>
    db.from('scenes').update({ scene_order: index + 1 }).eq('id', id)
  )

  await Promise.all(updates)
  revalidatePath(`/projects/${projectId}/scripts/${scriptId}`)
  return { success: true }
}

/**
 * Update scene content (heading and full script text)
 * Syncs heading slugline metadata (int_ext, location_name, time_of_day)
 */
export async function updateSceneContentAction(
  sceneId: string,
  heading: string,
  description: string,
  scriptId: string,
  projectId: string
): Promise<{ success?: boolean; error?: string }> {
  const db = await createClient()

  const cleanHeading = heading.trim().toUpperCase()
  const slug = parseSlugline(cleanHeading)

  const updatePayload: {
    heading: string
    description: string
    int_ext?: IntExt
    location_name?: string
    time_of_day?: TimeOfDay
  } = {
    heading: cleanHeading,
    description: description.trim(),
  }

  if (slug) {
    if (slug.intExt) updatePayload.int_ext = slug.intExt
    if (slug.locationName) updatePayload.location_name = slug.locationName
    if (slug.timeOfDay) updatePayload.time_of_day = slug.timeOfDay
  }

  const { data: before } = await db.from('scenes').select('location_name').eq('id', sceneId).single()

  const { error } = await db
    .from('scenes')
    .update(updatePayload)
    .eq('id', sceneId)

  if (error) return { error: error.message }

  // A new location in the slugline re-links the scene's Location in Cast & Crew and the bookings
  if (updatePayload.location_name && before?.location_name !== updatePayload.location_name) {
    await relinkSceneLocation(db, projectId, sceneId, before?.location_name ?? null, updatePayload.location_name)
    await syncProjectBookings(db, projectId)
  }

  revalidatePath(`/projects/${projectId}/scripts/${scriptId}`)
  return { success: true }
}

/**
 * Update script document metadata (file name, version, revision color, notes)
 */
export async function updateScriptMetadataAction(
  scriptId: string,
  projectId: string,
  updates: {
    fileName?: string
    version?: number
    revisionColor?: RevisionColor
    revisionNotes?: string | null
  }
): Promise<{ success?: boolean; error?: string }> {
  const db = await createClient()

  const payload: {
    file_name?: string
    version?: number
    revision_color?: RevisionColor
    revision_notes?: string | null
  } = {}
  if (updates.fileName) payload.file_name = updates.fileName
  if (updates.version !== undefined) payload.version = updates.version
  if (updates.revisionColor) payload.revision_color = updates.revisionColor
  if (updates.revisionNotes !== undefined) payload.revision_notes = updates.revisionNotes

  const { error } = await db
    .from('script_documents')
    .update(payload)
    .eq('id', scriptId)

  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}/scripts/${scriptId}`)
  return { success: true }
}

