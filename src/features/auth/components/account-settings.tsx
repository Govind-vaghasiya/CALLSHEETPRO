'use client'

import { useActionState, useMemo } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, LogOut, Mail, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useFeedback } from '@/components/ui/feedback-provider'
import {
  changeEmailAction,
  changePasswordAction,
  signOutEverywhereAction,
  updateProfileAction,
  type AuthState,
} from '../actions'

function Status({ state }: { state: AuthState }) {
  if (state.error)
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
        <AlertCircle className="size-4 mt-0.5 shrink-0" /> {state.error}
      </p>
    )
  if (state.success)
    return (
      <p className="flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4 mt-0.5 shrink-0" /> {state.success}
      </p>
    )
  return null
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 sm:p-6 grid gap-5 md:grid-cols-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Icon className="size-4 text-amber-600 dark:text-amber-400" /> {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="md:col-span-2 space-y-4">{children}</div>
    </section>
  )
}

const fieldClass = 'h-10 bg-background'

export function AccountSettings({
  email,
  pendingEmail,
  fullName,
  timezone,
}: {
  email: string
  pendingEmail: string | null
  fullName: string
  timezone: string
}) {
  const [profileState, profileAction, profilePending] = useActionState<AuthState, FormData>(updateProfileAction, {})
  const [emailState, emailAction, emailPending] = useActionState<AuthState, FormData>(changeEmailAction, {})
  const [passwordState, passwordAction, passwordPending] = useActionState<AuthState, FormData>(changePasswordAction, {})
  const { confirm } = useFeedback()

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return [timezone]
    }
  }, [timezone])

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Account settings</h1>
        <p className="text-sm text-muted-foreground">Your profile, sign-in email, password, and devices.</p>
      </div>

      <Section icon={UserRound} title="Profile" description="How your name appears to your team.">
        <form action={profileAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" name="fullName" defaultValue={fullName} required autoComplete="name" className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Time zone</Label>
              <select
                id="timezone"
                name="timezone"
                defaultValue={timezone}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground"
              >
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Status state={profileState} />
          <Button type="submit" disabled={profilePending} className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer">
            {profilePending ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Section>

      <Section icon={Mail} title="Email" description="Used to sign in and for call sheet and reset emails.">
        <p className="text-sm">
          Current: <span className="font-medium text-foreground">{email}</span>
        </p>
        {pendingEmail && (
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Waiting for confirmation of <span className="font-medium">{pendingEmail}</span> — check that inbox.
          </p>
        )}
        <form action={emailAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="newEmail">New email</Label>
            <Input id="newEmail" name="email" type="email" required autoComplete="email" className={fieldClass} />
          </div>
          <Status state={emailState} />
          <Button type="submit" variant="outline" disabled={emailPending} className="cursor-pointer">
            {emailPending ? 'Sending…' : 'Change email'}
          </Button>
        </form>
      </Section>

      <Section icon={KeyRound} title="Password" description="Changing it signs you out on your other devices.">
        <form action={passwordAction} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput id="currentPassword" name="currentPassword" required autoComplete="current-password" className={fieldClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <PasswordInput showRules id="password" name="password" required autoComplete="new-password" className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput id="confirmPassword" name="confirmPassword" required autoComplete="new-password" className={fieldClass} />
            </div>
          </div>
          <Status state={passwordState} />
          <Button type="submit" variant="outline" disabled={passwordPending} className="cursor-pointer">
            {passwordPending ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </Section>

      <Section icon={LogOut} title="Devices" description="Lost a laptop or signed in on a shared computer?">
        <form
          action={signOutEverywhereAction}
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await confirm({
              title: 'Sign out on all devices?',
              message: 'You will be signed out everywhere, including this browser.',
              confirmLabel: 'Sign out everywhere',
              destructive: true,
            })
            if (ok) await signOutEverywhereAction()
          }}
        >
          <Button type="submit" variant="destructive" className="cursor-pointer">
            Sign out on all devices
          </Button>
        </form>
      </Section>
    </div>
  )
}
