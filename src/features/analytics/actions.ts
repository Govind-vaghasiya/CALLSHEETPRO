'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import type { GuestPermission } from '@/types/database'
import type { ProductionMetrics, DailyPacingData, ShareableGuestLink, GuestAccessScope } from './types'

/** Page length of a scene (min 1/8 page, the smallest unit a stripboard counts). */
function scenePages(scene: { page_start: number | null; page_end: number | null }) {
  const start = Number(scene.page_start ?? 0)
  const end = Number(scene.page_end ?? start)
  return Math.max(0.125, end - start)
}
const round1 = (n: number) => Math.round(n * 10) / 10

export async function getProductionAnalyticsAction(projectId: string): Promise<{
  metrics: ProductionMetrics
  pacingHistory: DailyPacingData[]
}> {
  const supabase = await createClient()

  const [{ data: scenes }, { data: days }, { data: settings }, { data: resources }, { data: lineItems }, { data: bookings }] =
    await Promise.all([
      supabase
        .from('scenes')
        .select('id, scene_number, heading, int_ext, time_of_day, page_start, page_end')
        .eq('project_id', projectId),
      supabase
        .from('shoot_days')
        .select('id, day_number, shoot_date, status')
        .eq('project_id', projectId)
        .order('day_number', { ascending: true }),
      supabase.from('project_settings').select('currency, max_shooting_hours').eq('project_id', projectId).maybeSingle(),
      supabase.from('resources').select('id').eq('project_id', projectId),
      supabase.from('budget_line_items').select('amount').eq('project_id', projectId),
      supabase.from('resource_bookings').select('resource_id').eq('project_id', projectId),
    ])

  const dayIds = (days || []).map((d) => d.id)
  const { data: placements } = dayIds.length
    ? await supabase
        .from('shoot_day_scenes')
        .select('shoot_day_id, scene_id, sort_order')
        .in('shoot_day_id', dayIds)
        .order('sort_order', { ascending: true })
    : { data: [] }

  const pagesById = new Map((scenes || []).map((s) => [s.id, scenePages(s)]))
  const sceneById = new Map((scenes || []).map((s) => [s.id, s]))
  const totalPages = Array.from(pagesById.values()).reduce((a, b) => a + b, 0)

  const pacingHistory: DailyPacingData[] = (days || []).map((d, i) => {
    const dayScenes = (placements || []).filter((p) => p.shoot_day_id === d.id)
    return {
      dayId: d.id,
      scenes: dayScenes
        .map((p) => sceneById.get(p.scene_id))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({
          id: s.id,
          sceneNumber: s.scene_number,
          heading: s.heading,
          intExt: s.int_ext,
          timeOfDay: s.time_of_day,
        })),
      shootDay: d.day_number || i + 1,
      date: d.shoot_date,
      scheduledPages: round1(dayScenes.reduce((sum, p) => sum + (pagesById.get(p.scene_id) || 0), 0)),
      sceneCount: dayScenes.length,
      status: d.status,
    }
  })

  const completed = pacingHistory.filter((d) => d.status === 'COMPLETED')
  const pagesShot = completed.reduce((sum, d) => sum + d.scheduledPages, 0)
  const scheduledDays = pacingHistory.filter((d) => d.sceneCount > 0)
  const scheduledPages = scheduledDays.reduce((sum, d) => sum + d.scheduledPages, 0)

  // Budget estimate: every Cast & Crew rate × its days (estimated, else booked days) + line items
  const resourceIds = (resources || []).map((r) => r.id)
  const { data: rates } = resourceIds.length
    ? await supabase.from('resource_rates').select('resource_id, rate_type, rate_amount, estimated_days').in('resource_id', resourceIds)
    : { data: [] }
  const bookedDays = new Map<string, number>()
  for (const b of bookings || []) bookedDays.set(b.resource_id, (bookedDays.get(b.resource_id) || 0) + 1)
  const hoursPerDay = Number(settings?.max_shooting_hours ?? 10)
  let estimatedBudget = (lineItems || []).reduce((sum, li) => sum + Number(li.amount || 0), 0)
  for (const r of rates || []) {
    const amount = Number(r.rate_amount || 0)
    const daysWorked = Number(r.estimated_days ?? bookedDays.get(r.resource_id) ?? 0)
    if (r.rate_type === 'FLAT') estimatedBudget += amount
    else if (r.rate_type === 'DAILY') estimatedBudget += amount * daysWorked
    else if (r.rate_type === 'WEEKLY') estimatedBudget += amount * Math.ceil(daysWorked / 5)
    else if (r.rate_type === 'HOURLY') estimatedBudget += amount * hoursPerDay * daysWorked
  }

  const metrics: ProductionMetrics = {
    totalScriptPages: round1(totalPages),
    pagesShotCompleted: round1(pagesShot),
    pagesRemaining: round1(Math.max(0, totalPages - pagesShot)),
    completionPercentage: totalPages > 0 ? Math.round((pagesShot / totalPages) * 100) : 0,
    avgPagesPerDay: completed.length > 0 ? round1(pagesShot / completed.length) : null,
    targetPagesPerDay: scheduledDays.length > 0 ? round1(scheduledPages / scheduledDays.length) : null,
    totalShootDays: pacingHistory.length,
    shootDaysCompleted: completed.length,
    scheduledScenes: new Set((placements || []).map((p) => p.scene_id)).size,
    totalScenes: pagesById.size,
    estimatedBudget: Math.round(estimatedBudget),
    pricedResources: new Set((rates || []).map((r) => r.resource_id)).size,
    currency: settings?.currency || 'USD',
  }

  return { metrics, pacingHistory }
}

/** Which guest_token_permissions each share scope grants. */
const SCOPE_PERMISSIONS: Record<GuestAccessScope, GuestPermission[]> = {
  VIEW_CALL_SHEETS: ['READ_CALLSHEET'],
  VIEW_STRIPBOARD: ['READ_SCHEDULE'],
  FULL_READ_ONLY: ['READ_CALLSHEET', 'READ_SCHEDULE', 'READ_RESOURCES'],
}

function scopeFromPermissions(perms: GuestPermission[]): GuestAccessScope {
  if (perms.includes('READ_RESOURCES')) return 'FULL_READ_ONLY'
  if (perms.includes('READ_SCHEDULE')) return 'VIEW_STRIPBOARD'
  return 'VIEW_CALL_SHEETS'
}

/** Public base URL of this deployment (env first, then the incoming request). */
async function appBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function createShareableGuestLinkAction(
  projectId: string,
  accessScope: GuestAccessScope = 'VIEW_CALL_SHEETS',
  expirationDays: number = 7,
  label?: string
): Promise<{ success: boolean; guestLink?: ShareableGuestLink; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'You must be signed in.' }

  const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toISOString()
  const { data: token, error } = await supabase
    .from('guest_tokens')
    .insert({
      project_id: projectId,
      label: label?.trim() || `Guest link (${accessScope.replace(/_/g, ' ').toLowerCase()})`,
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select('*')
    .single()
  if (error || !token) return { success: false, error: error?.message || 'Could not create link' }

  // guest_token_permissions has RLS enabled with no policies, so it is written with the service key.
  // Safe: the token insert above already passed RLS (the user can modify this project).
  const { error: permError } = await createAdminClient()
    .from('guest_token_permissions')
    .insert(SCOPE_PERMISSIONS[accessScope].map((permission) => ({ token_id: token.id, permission })))
  if (permError) {
    await supabase.from('guest_tokens').delete().eq('id', token.id)
    return { success: false, error: permError.message }
  }

  revalidatePath(`/projects/${projectId}`)
  return {
    success: true,
    guestLink: {
      id: token.id,
      projectId,
      token: token.token,
      url: `${await appBaseUrl()}/guest/${token.token}`,
      accessScope,
      expiresAt,
      createdAt: token.created_at,
      visitCount: token.use_count,
    },
  }
}

/** Active guest links for a project (for the share dialog). */
export async function listGuestLinksAction(projectId: string): Promise<ShareableGuestLink[]> {
  const supabase = await createClient()
  const { data: tokens } = await supabase
    .from('guest_tokens')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  const base = await appBaseUrl()
  const now = new Date().toISOString()
  const live = (tokens || []).filter((t) => !t.expires_at || t.expires_at > now)
  // Tokens above were read under RLS (so the user is on this project); permissions need the service key
  const { data: permRows } = live.length
    ? await createAdminClient()
        .from('guest_token_permissions')
        .select('token_id, permission')
        .in('token_id', live.map((t) => t.id))
    : { data: [] }
  return live
    .map((t) => {
      const perms = (permRows || []).filter((p) => p.token_id === t.id).map((p) => p.permission)
      return {
        id: t.id,
        projectId,
        token: t.token,
        url: `${base}/guest/${t.token}`,
        accessScope: scopeFromPermissions(perms),
        expiresAt: t.expires_at || '',
        createdAt: t.created_at,
        visitCount: t.use_count,
      }
    })
}

export async function revokeGuestLinkAction(projectId: string, tokenId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('guest_tokens')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', tokenId)
  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}
