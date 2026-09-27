'use server'

import { revalidatePath } from 'next/cache'
import { notifyProjectMembers, recordActivity } from '@/features/collaboration/lib/activity'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/types/database'
import { buildCallSheet, type CallSheetDetails, type CallSheetFullData } from './lib/build-call-sheet'

export type {
  CallSheetSceneItem,
  CallSheetCastMember,
  CallSheetFullData,
  CallSheetDetails,
} from './lib/build-call-sheet'

/**
 * Fetch complete Call Sheet data for a shoot day in a project
 */
export async function getCallSheetDataAction(
  projectId: string,
  targetDayId?: string
): Promise<CallSheetFullData | null> {
  const supabase = await createClient()
  return buildCallSheet(supabase, projectId, targetDayId)
}

/** Get (or create) the draft call_sheets row for a shoot day. */
async function ensureCallSheetRow(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, dayId: string) {
  const { data: existing } = await supabase
    .from('call_sheets')
    .select('*')
    .eq('shoot_day_id', dayId)
    .order('version', { ascending: false })
    .limit(1)
  if (existing?.[0]) return existing[0]

  const { data: day } = await supabase.from('shoot_days').select('*').eq('id', dayId).single()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: created, error } = await supabase
    .from('call_sheets')
    .insert({
      project_id: projectId,
      shoot_day_id: dayId,
      title: day ? `Day ${day.day_number ?? ''} — ${day.shoot_date}` : null,
      shoot_date: day?.shoot_date ?? null,
      general_call_time: day?.call_time ?? null,
      primary_location_id: day?.primary_location_id ?? null,
      created_by: user?.id ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return created
}

/**
 * Save the editable parts of a call sheet (weather, meals, hospital, special instructions).
 * Editing a published sheet marks it REVISED so recipients know it changed.
 */
export async function saveCallSheetDetailsAction(
  projectId: string,
  dayId: string,
  details: CallSheetDetails
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  try {
    const row = await ensureCallSheetRow(supabase, projectId, dayId)
    const { error } = await supabase
      .from('call_sheets')
      .update({
        weather_data: details.weather as unknown as Json,
        branding_header: { breakfast: details.breakfast, lunch: details.lunch, unitName: details.unitName },
        special_instructions: details.specialInstructions || null,
        nearest_hospital: details.hospitalName || null,
        nearest_hospital_km: details.hospitalKm,
        status: row.status === 'PUBLISHED' ? 'REVISED' : row.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) return { success: false, error: error.message }
    revalidatePath(`/projects/${projectId}/callsheets`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save call sheet' }
  }
}

/** Publish the call sheet for a day; re-publishing a revised sheet bumps its version. */
export async function publishCallSheetAction(
  projectId: string,
  dayId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  try {
    const row = await ensureCallSheetRow(supabase, projectId, dayId)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: day } = await supabase.from('shoot_days').select('*').eq('id', dayId).single()
    const { error } = await supabase
      .from('call_sheets')
      .update({
        status: 'PUBLISHED',
        version: row.status === 'REVISED' ? row.version + 1 : row.version,
        published_at: new Date().toISOString(),
        published_by: user?.id ?? null,
        general_call_time: day?.call_time ?? null,
        primary_location_id: day?.primary_location_id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (error) return { success: false, error: error.message }

    const label = `Day ${day?.day_number ?? ''} call sheet${row.status === 'REVISED' ? ` (v${row.version + 1})` : ''}`
    await recordActivity(projectId, 'CALL_SHEET_PUBLISHED', `Published ${label}`, day?.shoot_date)
    await notifyProjectMembers(
      projectId,
      row.status === 'REVISED' ? 'CALL_SHEET_REVISED' : 'CALL_SHEET_PUBLISHED',
      `${label} ${row.status === 'REVISED' ? 'revised' : 'published'}`,
      `Shoot date ${day?.shoot_date ?? ''}.`,
      `/projects/${projectId}/callsheets`
    )

    revalidatePath(`/projects/${projectId}/callsheets`)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to publish call sheet' }
  }
}

/**
 * Update Call Sheet Shoot Day metadata (call time, wrap time, notes)
 */
export async function updateCallSheetNotesAction(
  dayId: string,
  updates: {
    callTime?: string
    wrapTime?: string
    notes?: string
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const payload: Partial<Database['public']['Tables']['shoot_days']['Update']> = {}
  if (updates.callTime !== undefined) payload.call_time = updates.callTime
  if (updates.wrapTime !== undefined) payload.wrap_time = updates.wrapTime
  if (updates.notes !== undefined) payload.notes = updates.notes
  payload.updated_at = new Date().toISOString()

  const { error } = await supabase.from('shoot_days').update(payload).eq('id', dayId)

  if (error) {
    return { success: false, error: error.message }
  }

  // A time change on a published sheet is a revision
  await supabase.from('call_sheets').update({ status: 'REVISED' }).eq('shoot_day_id', dayId).eq('status', 'PUBLISHED')

  return { success: true }
}
