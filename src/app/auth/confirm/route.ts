import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Where every auth email link lands (sign-up confirmation, password reset, email change).
 *
 * Supports both link styles:
 *  - ?token_hash=…&type=…  (recommended email templates — works on any device/browser)
 *  - ?code=…               (Supabase default links — must be opened in the same browser)
 * Then sends the user on to ?next=, or to a page that explains what went wrong.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')
  const rawNext = url.searchParams.get('next')
  const isRecovery = type === 'recovery' || rawNext?.startsWith('/reset-password')
  const next = safePath(rawNext, isRecovery ? '/reset-password' : '/dashboard')

  const supabase = await createClient()
  let failed: string | null = url.searchParams.get('error_description') || url.searchParams.get('error')

  if (!failed) {
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      failed = error?.message ?? null
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      failed = error?.message ?? null
    } else {
      failed = 'missing token'
    }
  }

  if (!failed) {
    return NextResponse.redirect(new URL(next, url.origin))
  }

  // Explain the failure where the user can fix it
  const sameBrowser = /code verifier|pkce/i.test(failed)

  // Sign-up links: Supabase confirms the email *before* redirecting here, so a code that can't be
  // exchanged (opened in another browser/app) still means "confirmed" — just sign in.
  if (sameBrowser && !isRecovery) {
    return NextResponse.redirect(new URL(`/login?notice=email-confirmed${rawNext ? `&redirectTo=${encodeURIComponent(next)}` : ''}`, url.origin))
  }
  const message = sameBrowser
    ? 'Please open the link in the same browser you requested it from, or request a new one here.'
    : 'This link has expired or was already used. Please request a new one.'
  const target = isRecovery
    ? `/forgot-password?error=${encodeURIComponent(message)}`
    : type === 'signup' || type === 'email' || rawNext?.startsWith('/org/new')
      ? `/login?error=${encodeURIComponent(
          sameBrowser ? message : 'This confirmation link has expired or was already used. Sign in, or resend the confirmation email.'
        )}`
      : `/login?error=${encodeURIComponent(message)}`
  return NextResponse.redirect(new URL(target, url.origin))
}

function safePath(path: string | null, fallback: string) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback
  return path
}
