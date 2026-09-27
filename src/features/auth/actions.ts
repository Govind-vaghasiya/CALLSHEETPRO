'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  error?: string
  success?: string
  /** Sign-in failed because the email isn't confirmed yet (offer to resend) */
  needsConfirmation?: boolean
  email?: string
}

/** Public URL of this deployment: env first, then the incoming request (works locally and on Netlify). */
async function appUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

/** Links in auth emails land on /auth/confirm, which then sends the user to `next`. */
async function confirmUrl(next: string) {
  return `${await appUrl()}/auth/confirm?next=${encodeURIComponent(next)}`
}

/** Only allow redirects back into this app (prevents open-redirects via ?redirectTo=). */
function safePath(path: string | null | undefined, fallback = '/dashboard') {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return fallback
  return path
}

/** Supabase error → message a person can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email or password is incorrect.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first — check your inbox for the confirmation link.'
  if (m.includes('user already registered')) return 'An account with this email already exists. Sign in, or reset your password.'
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return 'Too many attempts. Please wait a minute and try again.'
  if (m.includes('should be different')) return 'Your new password must be different from your current one.'
  if (m.includes('password should be') || m.includes('weak password')) return 'Please choose a stronger password (at least 8 characters, mixing letters and numbers).'
  if (m.includes('auth session missing') || m.includes('session_not_found'))
    return 'Your reset link has expired or was already used. Please request a new one.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Please enter a valid email address.'
  return message
}

function validatePassword(password: string, confirm: string): string | null {
  if (!password || !confirm) return 'Please fill in both password fields.'
  if (password.length < 8) return 'Password must be at least 8 characters long.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number.'
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

export async function signInAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const redirectTo = safePath(String(formData.get('redirectTo') || ''))

  if (!email || !password) {
    return { error: 'Please enter your email and password.', email }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      error: friendly(error.message),
      needsConfirmation: /email not confirmed/i.test(error.message),
      email,
    }
  }

  // New accounts go through onboarding first
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', data.user.id)
    .limit(1)

  if (!memberships || memberships.length === 0) {
    redirect('/org/new')
  }

  redirect(redirectTo)
}

export async function signUpAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get('fullName') || '').trim()
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')

  if (!fullName || !email || !password) {
    return { error: 'Please fill in all required fields.', email }
  }
  const invalid = validatePassword(password, confirmPassword)
  if (invalid) return { error: invalid, email }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: await confirmUrl('/org/new'),
    },
  })

  if (error) {
    return { error: friendly(error.message), email }
  }

  // Email confirmation is on: Supabase returns a user without a session.
  // (For an already-registered email it returns a user with no identities — same message, so
  // the form never reveals which emails have accounts.)
  if (data.user && !data.session) {
    return {
      success: `We sent a confirmation link to ${email}. Open it to activate your account.`,
      email,
    }
  }

  redirect('/org/new')
}

/** Send the sign-up confirmation email again. */
export async function resendConfirmationAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim()
  if (!email) return { error: 'Enter your email address first.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: await confirmUrl('/org/new') },
  })
  if (error) return { error: friendly(error.message), email }
  return { success: `A new confirmation link is on its way to ${email}.`, email }
}

export async function forgotPasswordAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim()

  if (!email) {
    return { error: 'Please enter your email address.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await confirmUrl('/reset-password'),
  })

  // Same message whether or not the account exists (don't reveal registered emails)
  if (error && !/user not found/i.test(error.message)) {
    return { error: friendly(error.message), email }
  }

  return {
    success: `If an account exists for ${email}, a reset link is on its way. It works once and expires in about an hour.`,
    email,
  }
}

export async function resetPasswordAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const password = String(formData.get('password') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')

  const invalid = validatePassword(password, confirmPassword)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Your reset link has expired or was already used. Please request a new one.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: friendly(error.message) }
  }

  // Sign out every other device that might have the old password
  await supabase.auth.signOut({ scope: 'others' })
  redirect('/dashboard?notice=password-updated')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ---------------------------------------------------------------------------------------------
// Account settings (signed in)
// ---------------------------------------------------------------------------------------------

export async function updateProfileAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const fullName = String(formData.get('fullName') || '').trim()
  const timezone = String(formData.get('timezone') || '').trim()
  if (!fullName) return { error: 'Please enter your name.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('user_profiles')
    .update({ full_name: fullName, ...(timezone ? { timezone } : {}) })
    .eq('id', user.id)
  if (error) return { error: error.message }

  // Keep the auth profile in step (used in emails)
  await supabase.auth.updateUser({ data: { full_name: fullName } })
  revalidatePath('/', 'layout')
  return { success: 'Profile saved.' }
}

/** Change password while signed in — the current password is checked first. */
export async function changePasswordAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const current = String(formData.get('currentPassword') || '')
  const password = String(formData.get('password') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')
  if (!current) return { error: 'Enter your current password.' }
  const invalid = validatePassword(password, confirmPassword)
  if (invalid) return { error: invalid }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { error: wrong } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
  if (wrong) return { error: 'Your current password is incorrect.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: friendly(error.message) }

  await supabase.auth.signOut({ scope: 'others' })
  return { success: 'Password changed. Other devices have been signed out.' }
}

/** Change email: Supabase sends a confirmation link (to both addresses when secure change is on). */
export async function changeEmailAction(_prevState: AuthState | null, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') || '').trim()
  if (!email) return { error: 'Enter the new email address.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (email.toLowerCase() === user.email?.toLowerCase()) return { error: 'That is already your email address.' }

  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: await confirmUrl('/account?notice=email-updated') })
  if (error) return { error: friendly(error.message), email }
  return {
    success: `Check ${email} (and your current inbox) for a confirmation link. Your email changes once it's confirmed.`,
    email,
  }
}

/** Sign out on every device, including this one. */
export async function signOutEverywhereAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login?notice=signed-out-everywhere')
}
