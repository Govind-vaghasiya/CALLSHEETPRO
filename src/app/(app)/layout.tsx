import React from 'react'
import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/layout/app-header'
import { FeedbackProvider } from '@/components/ui/feedback-provider'
import { UrlNotice } from '@/components/ui/url-notice'
import { Suspense } from 'react'
import { getCurrentUserWithProfile } from '@/features/organizations/actions'
import { getActiveOrganization } from '@/features/organizations/active-org'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUserWithProfile()

  if (!user) {
    redirect('/login')
  }

  const { organizations, active } = await getActiveOrganization()

  if (!active) {
    redirect('/org/new')
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-amber-500/30 selection:text-amber-800 dark:selection:text-amber-200">
      <FeedbackProvider>
        <Suspense>
          <UrlNotice />
        </Suspense>
        <AppHeader user={user} organizations={organizations} activeOrgId={active.organization.id} />
        <main className="flex-1 flex flex-col">{children}</main>
      </FeedbackProvider>
    </div>
  )
}
