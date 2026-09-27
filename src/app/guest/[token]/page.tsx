import React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveGuestToken } from '@/features/analytics/lib/guest-access'
import { buildCallSheet } from '@/features/callsheets/lib/build-call-sheet'
import { loadSchedule } from '@/features/scheduling/lib/load-schedule'
import { buildDoodReport } from '@/features/reports/lib/build-dood'
import { GuestViewer } from '@/features/analytics/components/guest-viewer'
import { Lock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function GuestViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ day?: string }>
}) {
  const { token } = await params
  const { day } = await searchParams
  const access = await resolveGuestToken(token)

  if (!access) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-sm text-center space-y-3">
          <Lock className="size-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-semibold">This link is not valid</h1>
          <p className="text-sm text-muted-foreground">
            It may have expired or been revoked. Ask the production office for a new link.
          </p>
        </div>
      </div>
    )
  }

  // Guests have no session: read with the service key, scoped to the token's project only
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('id, name').eq('id', access.projectId).single()

  // Guests only see call sheets the production has published
  let callSheet = null
  let publishedDays: Array<{ id: string; label: string }> = []
  if (access.permissions.includes('READ_CALLSHEET')) {
    const { data: sheets } = await admin
      .from('call_sheets')
      .select('shoot_day_id, shoot_days(day_number, shoot_date)')
      .eq('project_id', access.projectId)
      .in('status', ['PUBLISHED', 'REVISED'])
    publishedDays = (sheets || [])
      .map((s) => {
        const d = s.shoot_days as unknown as { day_number: number | null; shoot_date: string } | null
        return { id: s.shoot_day_id, label: `Day ${d?.day_number ?? '?'} — ${d?.shoot_date ?? ''}`, date: d?.shoot_date ?? '' }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ id, label }) => ({ id, label }))
    const dayId = publishedDays.find((d) => d.id === day)?.id || publishedDays[0]?.id
    if (dayId) callSheet = await buildCallSheet(admin, access.projectId, dayId)
  }

  const schedule = access.permissions.includes('READ_SCHEDULE') ? await loadSchedule(admin, access.projectId) : null
  const dood = access.permissions.includes('READ_RESOURCES') ? await buildDoodReport(admin, access.projectId) : null

  return (
    <GuestViewer
      token={token}
      projectName={project?.name || 'Production'}
      callSheet={callSheet}
      publishedDays={publishedDays}
      canViewCallSheets={access.permissions.includes('READ_CALLSHEET')}
      schedule={schedule}
      dood={dood}
    />
  )
}
