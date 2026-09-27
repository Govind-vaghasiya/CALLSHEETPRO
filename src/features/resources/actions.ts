'use server'

import { revalidatePath } from 'next/cache'
import { recordActivity } from '@/features/collaboration/lib/activity'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getResourceSceneUsage,
  propagateResourceLabel,
  syncProjectBookings,
} from '@/features/breakdown/lib/resource-links'
import type { ResourceType, RateType } from '@/types/database'

export interface ResourceActionState {
  error?: string
  success?: string
}

const DEFAULT_DEPARTMENTS_PRESET = [
  {
    name: 'Directing',
    code: 'DIR',
    color: '#f59e0b',
    sort_order: 1,
    roles: ['Director', '1st Assistant Director', '2nd Assistant Director', 'Script Supervisor'],
  },
  {
    name: 'Production',
    code: 'PROD',
    color: '#3b82f6',
    sort_order: 2,
    roles: ['Producer', 'Executive Producer', 'Line Producer', 'Unit Production Manager', 'Production Coordinator', 'Production Assistant'],
  },
  {
    name: 'Camera',
    code: 'CAM',
    color: '#ef4444',
    sort_order: 3,
    roles: ['Director of Photography', 'Camera Operator', '1st AC (Focus Puller)', '2nd AC (Clapper)', 'DIT', 'Still Photographer'],
  },
  {
    name: 'Lighting & Grip',
    code: 'GRIP',
    color: '#eab308',
    sort_order: 4,
    roles: ['Gaffer', 'Best Boy Electric', 'Key Grip', 'Best Boy Grip', 'Dolly Grip'],
  },
  {
    name: 'Sound',
    code: 'SND',
    color: '#10b981',
    sort_order: 5,
    roles: ['Sound Mixer', 'Boom Operator', 'Sound Utility'],
  },
  {
    name: 'Art & Props',
    code: 'ART',
    color: '#8b5cf6',
    sort_order: 6,
    roles: ['Production Designer', 'Art Director', 'Set Decorator', 'Property Master', 'Leadman'],
  },
  {
    name: 'Wardrobe & Costume',
    code: 'WARD',
    color: '#ec4899',
    sort_order: 7,
    roles: ['Costume Designer', 'Wardrobe Supervisor', 'Set Costumer'],
  },
  {
    name: 'Hair & Makeup',
    code: 'HMU',
    color: '#f43f5e',
    sort_order: 8,
    roles: ['Key Makeup Artist', 'Key Hair Stylist', 'SFX Makeup Artist'],
  },
  {
    name: 'Stunts',
    code: 'STUNT',
    color: '#dc2626',
    sort_order: 9,
    roles: ['Stunt Coordinator', 'Stunt Double', 'Stunt Performer'],
  },
  {
    name: 'Locations',
    code: 'LOC',
    color: '#06b6d4',
    sort_order: 10,
    roles: ['Location Manager', 'Assistant Location Manager', 'Location Scout'],
  },
  {
    name: 'Transportation',
    code: 'TRANS',
    color: '#64748b',
    sort_order: 11,
    roles: ['Transportation Coordinator', 'Transportation Captain', 'Driver'],
  },
  {
    name: 'Catering & Craft',
    code: 'CRAFT',
    color: '#84cc16',
    sort_order: 12,
    roles: ['Key Craft Service', 'Head Caterer'],
  },
  {
    name: 'Post-Production',
    code: 'POST',
    color: '#6366f1',
    sort_order: 13,
    roles: ['Editor', 'Assistant Editor', 'Colorist', 'Sound Designer', 'VFX Supervisor'],
  },
  {
    name: 'Cast / Talent',
    code: 'CAST',
    color: '#d97706',
    sort_order: 14,
    roles: ['Lead Cast', 'Supporting Cast', 'Day Player', 'Background / Extra', 'Stand-In'],
  },
]

export async function ensureDefaultDepartments(projectId: string) {
  const supabase = await createClient()

  // Check if departments exist
  const { data: existingDepts, error } = await supabase
    .from('departments')
    .select('id, name')
    .eq('project_id', projectId)

  if (error) {
    console.error('Error fetching departments:', error)
    return
  }

  if (existingDepts && existingDepts.length > 0) {
    return
  }

  // Seed default departments & roles
  for (const deptPreset of DEFAULT_DEPARTMENTS_PRESET) {
    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .insert({
        project_id: projectId,
        name: deptPreset.name,
        code: deptPreset.code,
        color: deptPreset.color,
        sort_order: deptPreset.sort_order,
      })
      .select('id')
      .single()

    if (deptError || !dept) {
      console.error(`Error creating department ${deptPreset.name}:`, deptError)
      continue
    }

    const rolesToInsert = deptPreset.roles.map((roleName, idx) => ({
      department_id: dept.id,
      project_id: projectId,
      name: roleName,
      sort_order: idx + 1,
    }))

    await supabase.from('roles').insert(rolesToInsert)
  }
}

export interface DepartmentWithRoles {
  id: string
  name: string
  code: string | null
  color: string | null
  sort_order: number
  roles: Array<{
    id: string
    name: string
    sort_order: number
  }>
}

export interface ResourceWithDetails {
  id: string
  project_id: string
  resource_type: ResourceType
  name: string
  display_name: string | null
  email: string | null
  phone: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  resource_roles: Array<{
    id: string
    is_primary: boolean
    role: {
      id: string
      name: string
      department: {
        id: string
        name: string
        code: string | null
        color: string | null
      } | null
    } | null
  }>
  resource_rates: Array<{
    id: string
    rate_type: string
    rate_amount: number | null
    currency: string
    estimated_days: number | null
    notes: string | null
  }>
  location_details: Array<{
    id: string
    address_line1: string | null
    address_line2: string | null
    city: string | null
    state_province: string | null
    postal_code: string | null
    country: string | null
    parking_notes: string | null
    nearest_hospital: string | null
    nearest_hospital_km: number | null
    access_hours_start?: string | null
    access_hours_end?: string | null
    permit_required: boolean
    permit_type?: string | null
    permit_expiry?: string | null
    permit_notes?: string | null
  }>
}

export async function getDepartmentsAndRoles(projectId: string): Promise<DepartmentWithRoles[]> {
  await ensureDefaultDepartments(projectId)

  const supabase = await createClient()
  const [deptsRes, rolesRes] = await Promise.all([
    supabase
      .from('departments')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('roles')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ])

  const depts = deptsRes.data || []
  const roles = rolesRes.data || []

  return depts.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    color: d.color,
    sort_order: d.sort_order,
    roles: roles
      .filter((r) => r.department_id === d.id)
      .map((r) => ({
        id: r.id,
        name: r.name,
        sort_order: r.sort_order,
      })),
  }))
}

export async function getResources(
  projectId: string,
  filterType?: ResourceType | 'ALL'
): Promise<ResourceWithDetails[]> {
  const supabase = await createClient()

  let resQuery = supabase
    .from('resources')
    .select('*')
    .eq('project_id', projectId)
    .order('name', { ascending: true })

  if (filterType && filterType !== 'ALL') {
    resQuery = resQuery.eq('resource_type', filterType)
  }

  const { data: resources, error } = await resQuery

  if (error || !resources || resources.length === 0) {
    return []
  }

  const resourceIds = resources.map((r) => r.id)

  const [rolesRes, ratesRes, locsRes, allRolesRes, allDeptsRes] = await Promise.all([
    supabase
      .from('resource_roles')
      .select('*')
      .in('resource_id', resourceIds),
    supabase
      .from('resource_rates')
      .select('*')
      .in('resource_id', resourceIds),
    supabase
      .from('location_details')
      .select('*')
      .in('resource_id', resourceIds),
    supabase
      .from('roles')
      .select('*')
      .eq('project_id', projectId),
    supabase
      .from('departments')
      .select('*')
      .eq('project_id', projectId),
  ])

  const resourceRoles = rolesRes.data || []
  const resourceRates = ratesRes.data || []
  const locationDetails = locsRes.data || []
  const rolesMap = new Map((allRolesRes.data || []).map((r) => [r.id, r]))
  const deptsMap = new Map((allDeptsRes.data || []).map((d) => [d.id, d]))

  return resources.map((r) => {
    const rRoles = resourceRoles
      .filter((rr) => rr.resource_id === r.id)
      .map((rr) => {
        const role = rolesMap.get(rr.role_id)
        const dept = role ? deptsMap.get(role.department_id) : null
        return {
          id: rr.id,
          is_primary: rr.is_primary,
          role: role
            ? {
                id: role.id,
                name: role.name,
                department: dept
                  ? {
                      id: dept.id,
                      name: dept.name,
                      code: dept.code,
                      color: dept.color,
                    }
                  : null,
              }
            : null,
        }
      })

    const rRates = resourceRates.filter((rt) => rt.resource_id === r.id)
    const rLocs = locationDetails.filter((loc) => loc.resource_id === r.id)

    return {
      ...r,
      resource_roles: rRoles,
      resource_rates: rRates,
      location_details: rLocs,
    }
  })
}

export async function getResourceById(
  resourceId: string
): Promise<ResourceWithDetails | null> {
  const supabase = await createClient()

  const { data: resource, error } = await supabase
    .from('resources')
    .select('*')
    .eq('id', resourceId)
    .single()

  if (error || !resource) return null

  const [rolesRes, ratesRes, locsRes, allRolesRes, allDeptsRes] = await Promise.all([
    supabase
      .from('resource_roles')
      .select('*')
      .eq('resource_id', resourceId),
    supabase
      .from('resource_rates')
      .select('*')
      .eq('resource_id', resourceId),
    supabase
      .from('location_details')
      .select('*')
      .eq('resource_id', resourceId),
    supabase
      .from('roles')
      .select('*')
      .eq('project_id', resource.project_id),
    supabase
      .from('departments')
      .select('*')
      .eq('project_id', resource.project_id),
  ])

  const resourceRoles = rolesRes.data || []
  const resourceRates = ratesRes.data || []
  const locationDetails = locsRes.data || []
  const rolesMap = new Map((allRolesRes.data || []).map((r) => [r.id, r]))
  const deptsMap = new Map((allDeptsRes.data || []).map((d) => [d.id, d]))

  const rRoles = resourceRoles.map((rr) => {
    const role = rolesMap.get(rr.role_id)
    const dept = role ? deptsMap.get(role.department_id) : null
    return {
      id: rr.id,
      is_primary: rr.is_primary,
      role: role
        ? {
            id: role.id,
            name: role.name,
            department: dept
              ? {
                  id: dept.id,
                  name: dept.name,
                  code: dept.code,
                  color: dept.color,
                }
              : null,
          }
        : null,
    }
  })

  return {
    ...resource,
    resource_roles: rRoles,
    resource_rates: resourceRates,
    location_details: locationDetails,
  }
}

export async function createResourceAction(
  projectId: string,
  _prevState: ResourceActionState | null,
  formData: FormData
): Promise<ResourceActionState> {
  const resourceType = formData.get('resourceType') as ResourceType
  const name = formData.get('name') as string
  const displayName = (formData.get('displayName') as string) || null
  const email = (formData.get('email') as string) || null
  const phone = (formData.get('phone') as string) || null
  const notes = (formData.get('notes') as string) || null
  const roleId = (formData.get('roleId') as string) || null

  // Rate fields
  const rateType = (formData.get('rateType') as RateType) || 'DAILY'
  const rateAmountRaw = formData.get('rateAmount') as string
  const rateAmount = rateAmountRaw ? Number(rateAmountRaw) : null
  const currency = (formData.get('currency') as string) || 'USD'
  const estimatedDaysRaw = formData.get('estimatedDays') as string
  const estimatedDays = estimatedDaysRaw ? Number(estimatedDaysRaw) : null

  // Location fields (if LOCATION)
  const addressLine1 = (formData.get('addressLine1') as string) || null
  const addressLine2 = (formData.get('addressLine2') as string) || null
  const city = (formData.get('city') as string) || null
  const stateProvince = (formData.get('stateProvince') as string) || null
  const postalCode = (formData.get('postalCode') as string) || null
  const country = (formData.get('country') as string) || null
  const parkingNotes = (formData.get('parkingNotes') as string) || null
  const nearestHospital = (formData.get('nearestHospital') as string) || null
  const nearestHospitalKmRaw = formData.get('nearestHospitalKm') as string
  const nearestHospitalKm = nearestHospitalKmRaw ? Number(nearestHospitalKmRaw) : null
  const permitRequired = formData.get('permitRequired') === 'on'
  const permitNotes = (formData.get('permitNotes') as string) || null

  if (!name || !name.trim()) {
    return { error: 'Resource name is required.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Insert Resource
  const { data: resource, error: resError } = await supabase
    .from('resources')
    .insert({
      project_id: projectId,
      resource_type: resourceType,
      name: name.trim(),
      display_name: displayName?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      created_by: user?.id || null,
    })
    .select('id')
    .single()

  if (resError || !resource) {
    return { error: resError?.message || 'Failed to create resource.' }
  }
  await recordActivity(projectId, 'RESOURCE_ADDED', `Added ${name.trim()} to Cast & Crew`)

  // 2. Insert Role (if PERSON and role selected)
  if (roleId) {
    await supabase.from('resource_roles').insert({
      resource_id: resource.id,
      role_id: roleId,
      is_primary: true,
    })
  }

  // 3. Insert Rate (if rate specified)
  if (rateAmount !== null || estimatedDays !== null) {
    await supabase.from('resource_rates').insert({
      resource_id: resource.id,
      rate_type: rateType,
      rate_amount: rateAmount,
      currency,
      estimated_days: estimatedDays,
    })
  }

  // 4. Insert Location Details (if LOCATION)
  if (resourceType === 'LOCATION') {
    await supabase.from('location_details').insert({
      resource_id: resource.id,
      address_line1: addressLine1?.trim() || null,
      address_line2: addressLine2?.trim() || null,
      city: city?.trim() || null,
      state_province: stateProvince?.trim() || null,
      postal_code: postalCode?.trim() || null,
      country: country?.trim() || null,
      parking_notes: parkingNotes?.trim() || null,
      nearest_hospital: nearestHospital?.trim() || null,
      nearest_hospital_km: nearestHospitalKm,
      permit_required: permitRequired,
      permit_notes: permitNotes?.trim() || null,
    })
  }

  revalidatePath(`/projects/${projectId}/resources`)
  redirect(`/projects/${projectId}/resources`)
}

export async function updateResourceAction(
  resourceId: string,
  projectId: string,
  _prevState: ResourceActionState | null,
  formData: FormData
): Promise<ResourceActionState> {
  const name = formData.get('name') as string
  const displayName = (formData.get('displayName') as string) || null
  const email = (formData.get('email') as string) || null
  const phone = (formData.get('phone') as string) || null
  const notes = (formData.get('notes') as string) || null
  const roleId = (formData.get('roleId') as string) || null
  const resourceType = formData.get('resourceType') as ResourceType

  // Rate fields
  const rateType = (formData.get('rateType') as RateType) || 'DAILY'
  const rateAmountRaw = formData.get('rateAmount') as string
  const rateAmount =
    rateAmountRaw !== '' && rateAmountRaw !== null && !isNaN(Number(rateAmountRaw))
      ? Number(rateAmountRaw)
      : null
  const currency = (formData.get('currency') as string) || 'USD'
  const estimatedDaysRaw = formData.get('estimatedDays') as string
  const estimatedDays =
    estimatedDaysRaw !== '' && estimatedDaysRaw !== null && !isNaN(Number(estimatedDaysRaw))
      ? Number(estimatedDaysRaw)
      : null

  // Location fields
  const addressLine1 = (formData.get('addressLine1') as string) || null
  const addressLine2 = (formData.get('addressLine2') as string) || null
  const city = (formData.get('city') as string) || null
  const stateProvince = (formData.get('stateProvince') as string) || null
  const postalCode = (formData.get('postalCode') as string) || null
  const country = (formData.get('country') as string) || null
  const parkingNotes = (formData.get('parkingNotes') as string) || null
  const nearestHospital = (formData.get('nearestHospital') as string) || null
  const nearestHospitalKmRaw = formData.get('nearestHospitalKm') as string
  const nearestHospitalKm = nearestHospitalKmRaw ? Number(nearestHospitalKmRaw) : null
  const permitRequired = formData.get('permitRequired') === 'on'
  const permitNotes = (formData.get('permitNotes') as string) || null

  const supabase = await createClient()

  // 1. Update resource core
  const { error: resError } = await supabase
    .from('resources')
    .update({
      name: name.trim(),
      display_name: displayName?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
    })
    .eq('id', resourceId)

  if (resError) {
    return { error: resError.message }
  }

  // Keep every breakdown element linked to this entry showing the same name
  await propagateResourceLabel(supabase, resourceId)

  // 2. Update/upsert role
  if (roleId) {
    const { data: existingRole } = await supabase
      .from('resource_roles')
      .select('id')
      .eq('resource_id', resourceId)
      .maybeSingle()

    if (existingRole) {
      await supabase
        .from('resource_roles')
        .update({ role_id: roleId, is_primary: true })
        .eq('id', existingRole.id)
    } else {
      await supabase.from('resource_roles').insert({
        resource_id: resourceId,
        role_id: roleId,
        is_primary: true,
      })
    }
  }

  // 3. Update/upsert rate
  if (rateAmount !== null || estimatedDays !== null) {
    const { data: existingRate } = await supabase
      .from('resource_rates')
      .select('id')
      .eq('resource_id', resourceId)
      .maybeSingle()

    if (existingRate) {
      await supabase
        .from('resource_rates')
        .update({
          rate_type: rateType,
          rate_amount: rateAmount,
          currency,
          estimated_days: estimatedDays,
        })
        .eq('id', existingRate.id)
    } else {
      await supabase.from('resource_rates').insert({
        resource_id: resourceId,
        rate_type: rateType,
        rate_amount: rateAmount,
        currency,
        estimated_days: estimatedDays,
      })
    }
  } else {
    // If rate fields are cleared, delete existing rate
    await supabase.from('resource_rates').delete().eq('resource_id', resourceId)
  }

  // 4. Update/upsert location details
  if (resourceType === 'LOCATION') {
    const { data: existingLoc } = await supabase
      .from('location_details')
      .select('id')
      .eq('resource_id', resourceId)
      .maybeSingle()

    const locPayload = {
      address_line1: addressLine1?.trim() || null,
      address_line2: addressLine2?.trim() || null,
      city: city?.trim() || null,
      state_province: stateProvince?.trim() || null,
      postal_code: postalCode?.trim() || null,
      country: country?.trim() || null,
      parking_notes: parkingNotes?.trim() || null,
      nearest_hospital: nearestHospital?.trim() || null,
      nearest_hospital_km: nearestHospitalKm,
      permit_required: permitRequired,
      permit_notes: permitNotes?.trim() || null,
    }

    if (existingLoc) {
      await supabase
        .from('location_details')
        .update(locPayload)
        .eq('id', existingLoc.id)
    } else {
      await supabase.from('location_details').insert({
        resource_id: resourceId,
        ...locPayload,
      })
    }
  }

  revalidatePath(`/projects/${projectId}/resources`)
  revalidatePath(`/projects/${projectId}/resources/${resourceId}`)
  redirect(`/projects/${projectId}/resources`)
}

/** Scenes a Cast & Crew entry is tagged in (shown on its page and in the delete warning). */
export async function getResourceSceneUsageAction(resourceId: string) {
  const supabase = await createClient()
  return getResourceSceneUsage(supabase, resourceId)
}

export async function deleteResourceAction(
  resourceId: string,
  projectId: string
): Promise<void> {
  const supabase = await createClient()

  // The entry is the source of truth: removing it removes its breakdown tags too
  const { data: links } = await supabase
    .from('scene_requirements')
    .select('element_id, scene_elements(element_type)')
    .eq('resource_id', resourceId)
  // Cast items belong to their character, which simply becomes uncast; other tagged items go
  const elementIds = ((links || []) as unknown as Array<{ element_id: string | null; scene_elements: { element_type: string } | null }>)
    .filter((l) => l.scene_elements?.element_type !== 'CAST')
    .map((l) => l.element_id)
    .filter((id): id is string => !!id)

  const { data: removed } = await supabase.from('resources').select('name').eq('id', resourceId).maybeSingle()
  const { error } = await supabase.from('resources').delete().eq('id', resourceId)
  if (!error && removed) await recordActivity(projectId, 'RESOURCE_REMOVED', `Removed ${removed.name} from Cast & Crew`)
  if (!error && elementIds.length > 0) {
    await supabase.from('scene_elements').delete().in('id', elementIds)
  }
  await syncProjectBookings(supabase, projectId)

  revalidatePath(`/projects/${projectId}/resources`)
  revalidatePath(`/projects/${projectId}/breakdown`)
  redirect(`/projects/${projectId}/resources`)
}
