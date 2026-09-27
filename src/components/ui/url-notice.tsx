'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useFeedback } from './feedback-provider'

const NOTICES: Record<string, string> = {
  'password-updated': 'Your password was updated. Other devices have been signed out.',
  'email-updated': 'Your email address has been confirmed and updated.',
}

/** Shows a one-time confirmation for ?notice=… after auth redirects, then cleans the URL. */
export function UrlNotice() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { notify } = useFeedback()
  const notice = params.get('notice')

  useEffect(() => {
    if (!notice || !NOTICES[notice]) return
    notify(NOTICES[notice], 'success')
    const rest = new URLSearchParams(params.toString())
    rest.delete('notice')
    router.replace(rest.size ? `${pathname}?${rest}` : pathname)
  }, [notice, notify, params, pathname, router])

  return null
}
