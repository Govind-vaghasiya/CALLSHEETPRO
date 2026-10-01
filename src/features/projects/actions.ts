'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProjectType, ProjectStatus } from '@/types/database'
import { getActiveOrganization } from '@/features/organizations/active-org'

export type ProjectActionState = {
  error?: string
  success?: string
}

export async function createProjectAction(
  _prevState: ProjectActionState | null,
  formData: FormData
): Promise<ProjectActionState> {
  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || null
  const projectType = (formData.get('projectType') as ProjectType) || 'FEATURE'
  const status = (formData.get('status') as ProjectStatus) || 'PRE_PRODUCTION'
  const startDate = (formData.get('startDate') as string) || null
  const targetWrapDate = (formData.get('targetWrapDate') as string) || null
  const timezone = (formData.get('timezone') as string) || 'UTC'
  const currency = (formData.get('currency') as string) || 'USD'
  const defaultCallTime = (formData.get('defaultCallTime') as string) || '07:00'

  if (!name || name.trim().length === 0) {
    return { error: 'Please provide a production name.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // The production goes into the organization the user is working in (header switcher)
  const { active } = await getActiveOrganization()
  const organizationId = active?.organization.id
  if (!organizationId) {
    redirect('/org/new')
  }

  const adminClient = createAdminClient()

  // 1. Insert project
  const { data: project, error: projectError } = await adminClient
    .from('projects')
    .insert({
      organization_id: organizationId,
      name: name.trim(),
      description,
      project_type: projectType,
      status,
      start_date: startDate,
      target_end_date: targetWrapDate,
      timezone,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (projectError) {
    return { error: projectError.message }
  }

  // 2. Ensure creator is OWNER in project_members (safe upsert in case trigger already added them)
  await adminClient.from('project_members').upsert(
    {
      project_id: project.id,
      user_id: user.id,
      role: 'OWNER',
    },
    { onConflict: 'project_id,user_id', ignoreDuplicates: true }
  )

  // 3. Update default project_settings
  const { error: settingsError } = await adminClient
    .from('project_settings')
    .update({
      default_call_time: defaultCallTime,
      currency: currency,
      max_shooting_hours: 10,
      min_turnaround_hours: 12,
    })
    .eq('project_id', project.id)

  if (settingsError) {
    // If no row was found to update for any reason, insert it
    await adminClient.from('project_settings').upsert(
      {
        project_id: project.id,
        default_call_time: defaultCallTime,
        currency: currency,
        max_shooting_hours: 10,
        min_turnaround_hours: 12,
      },
      { onConflict: 'project_id' }
    )
  }

  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect(`/projects/${project.id}`)
}

export async function updateProjectSettingsAction(
  projectId: string,
  _prevState: ProjectActionState | null,
  formData: FormData
): Promise<ProjectActionState> {
  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || ''
  const status = formData.get('status') as ProjectStatus
  const projectType = formData.get('projectType') as ProjectType
  const timezone = (formData.get('timezone') as string) || 'America/New_York'
  const currency = (formData.get('currency') as string) || 'USD'
  const startDate = (formData.get('startDate') as string) || null
  const targetWrapDate = (formData.get('targetWrapDate') as string) || null
  const defaultCallTime = (formData.get('defaultCallTime') as string) || '07:00'
  const minTurnaroundHours = Number(formData.get('minTurnaroundHours') || 12)
  const maxWorkingHours = Number(formData.get('maxWorkingHours') || 10)
  const companyMoveThreshold = Number(formData.get('companyMoveThreshold') || 30)

  const adminClient = createAdminClient()

  // Update project details
  const { error: projError } = await adminClient
    .from('projects')
    .update({
      name: name.trim(),
      description: description.trim(),
      status,
      project_type: projectType,
      timezone,
      start_date: startDate,
      target_end_date: targetWrapDate,
    })
    .eq('id', projectId)

  if (projError) {
    return { error: projError.message }
  }

  // Update project settings safely using UPDATE on project_id
  const { data: existingSettings } = await adminClient
    .from('project_settings')
    .select('id')
    .eq('project_id', projectId)
    .maybeSingle()

  if (existingSettings) {
    const { error: updateError } = await adminClient
      .from('project_settings')
      .update({
        default_call_time: defaultCallTime,
        currency,
        min_turnaround_hours: minTurnaroundHours,
        max_shooting_hours: maxWorkingHours,
        company_move_threshold: companyMoveThreshold,
      })
      .eq('project_id', projectId)

    if (updateError) {
      return { error: updateError.message }
    }
  } else {
    const { error: insertError } = await adminClient
      .from('project_settings')
      .insert({
        project_id: projectId,
        default_call_time: defaultCallTime,
        currency,
        min_turnaround_hours: minTurnaroundHours,
        max_shooting_hours: maxWorkingHours,
        company_move_threshold: companyMoveThreshold,
      })

    if (insertError) {
      return { error: insertError.message }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/settings`)
  return { success: 'Production settings saved successfully!' }
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const adminClient = createAdminClient()
  await adminClient.from('projects').delete().eq('id', projectId)
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  redirect('/projects')
}

export async function getProjects(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return data
}

export async function getProjectById(projectId: string) {
  const supabase = await createClient()
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error || !project) return null

  const { data: settings } = await supabase
    .from('project_settings')
    .select('*')
    .eq('project_id', projectId)
    .single()

  return {
    ...project,
    project_settings: settings,
  }
}
