'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { switchOrganizationAction } from '../actions'

/**
 * Rendered when the open production belongs to a different organization than the active one
 * (e.g. opened from a shared link): makes its organization active so the header and menus match.
 */
export function SyncActiveOrganization({ organizationId }: { organizationId: string }) {
  const router = useRouter()
  useEffect(() => {
    switchOrganizationAction(organizationId)
      .then((r) => {
        if (!r.error) router.refresh()
      })
      .catch(() => {})
  }, [organizationId, router])
  return null
}
