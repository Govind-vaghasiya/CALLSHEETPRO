'use client'

import { useActionState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signInAction, type AuthState } from '@/features/auth/actions'
import { PasswordInput } from '@/components/ui/password-input'
import { ResendConfirmation } from '@/features/auth/components/resend-confirmation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Film, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  const redirectTo = searchParams.get('redirectTo') || ''
  const NOTICES: Record<string, string> = {
    'signed-out-everywhere': 'You have been signed out on all devices.',
    'email-confirmed': 'Your email is confirmed. Sign in to continue.',
  }
  const notice = NOTICES[searchParams.get('notice') || ''] ?? null
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signInAction,
    { error: urlError ?? undefined }
  )

  return (
    <Card className="border-border bg-card/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-2 pb-6 border-b border-border/60">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono tracking-wider uppercase font-semibold">
          <Film className="size-3.5" /> Production Portal
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Sign In to CallSheetPro
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Access your shooting schedules, stripboards, and call sheets.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          {notice && !state?.error && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm">
              <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}
          {state?.error && (
            <div role="alert" className="flex items-start gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-sm animate-in fade-in">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <span>{state.error}</span>
                {state.needsConfirmation && <ResendConfirmation email={state.email} />}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="producer@studio.com"
              defaultValue={state?.email}
              required
              autoComplete="email"
              className="bg-background/80 border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-11"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="bg-background/80 border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-11"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 pt-2 pb-6">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Authenticating...
              </>
            ) : (
              <>
                Enter Workspace
                <ArrowRight className="size-4 ml-2" />
              </>
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Don&apos;t have a CallSheetPro account?{' '}
            <Link
              href="/signup"
              className="font-medium text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline underline-offset-4"
            >
              Create an account
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
