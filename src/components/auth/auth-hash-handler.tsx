'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Some Supabase settings return auth results in the URL fragment (#access_token=… or #error=…),
 * which the server never sees. Pick them up on whatever page the link landed on.
 */
export function AuthHashHandler() {
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash || !/(access_token|error_description)=/.test(hash)) return
    const params = new URLSearchParams(hash)
    const clean = () => window.history.replaceState(null, '', window.location.pathname + window.location.search)

    const error = params.get('error_description')
    if (error) {
      clean()
      const recovery = params.get('type') === 'recovery'
      const message = /expired|invalid/i.test(error)
        ? 'This link has expired or was already used. Please request a new one.'
        : error
      window.location.replace(`${recovery ? '/forgot-password' : '/login'}?error=${encodeURIComponent(message)}`)
      return
    }

    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return
    const type = params.get('type')
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error: sessionError }) => {
        clean()
        if (sessionError) {
          window.location.replace(`/login?error=${encodeURIComponent('That link could not be used. Please sign in.')}`)
        } else {
          window.location.replace(type === 'recovery' ? '/reset-password' : '/dashboard')
        }
      })
  }, [])

  return null
}
