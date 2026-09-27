'use client'

import { useActionState, Suspense } from 'react'
import Link from 'next/link'
import { resetPasswordAction, type AuthState } from '@/features/auth/actions'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { ShieldCheck, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'

function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    resetPasswordAction,
    {}
  )

  return (
    <Card className="border-border bg-card/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-2 pb-6 border-b border-border/60">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono tracking-wider uppercase font-semibold">
          <ShieldCheck className="size-3.5" /> Security Recovery
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Create New Password
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Enter a strong new password for your CallSheetPro account.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          {state?.error && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-sm animate-in fade-in">
              <AlertCircle className="size-5 shrink-0 mt-0.5" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <PasswordInput
              showRules
              autoFocus
              id="password"
              name="password"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              className="bg-background/80 border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
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
                Updating Password...
              </>
            ) : (
              'Save & Enter Workspace'
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Return to Sign In
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
