'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type AuthState = {
  error?: string
  success?: string
}

export async function signInAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Please provide both email and password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Check if user has an organization
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('id, organization_id')
      .eq('user_id', user.id)
      .limit(1)

    if (!memberships || memberships.length === 0) {
      redirect('/org/new')
    }
  }

  redirect('/dashboard')
}

export async function signUpAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const fullName = formData.get('fullName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!fullName || !email || !password) {
    return { error: 'Please fill in all required fields.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // If email confirmation is enabled and user has no session yet
  if (data.user && !data.session) {
    return {
      success:
        'Registration successful! Please check your email to confirm your account.',
    }
  }

  redirect('/org/new')
}

export async function forgotPasswordAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const email = formData.get('email') as string

  if (!email) {
    return { error: 'Please enter your email address.' }
  }

  const supabase = await createClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return {
    success: 'Password reset instructions have been sent to your email.',
  }
}

export async function resetPasswordAction(
  _prevState: AuthState | null,
  formData: FormData
): Promise<AuthState> {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    return { error: 'Please fill in all fields.' }
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters long.' }
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
