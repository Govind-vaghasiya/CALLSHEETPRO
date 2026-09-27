'use client'

import { useActionState, Suspense } from 'react'
import Link from 'next/link'
import { forgotPasswordAction, type AuthState } from '@/features/auth/actions'
import { useSearchParams } from 'next/navigation'
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
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react'

function ForgotPasswordForm() {
  const searchParams = useSearchParams()
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    forgotPasswordAction,
    { error: searchParams.get('error') ?? undefined }
  )

  return (
    <Card className="border-border bg-card/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-2 pb-6 border-b border-border/60">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono tracking-wider uppercase font-semibold">
          <KeyRound className="size-3.5" /> Security Recovery
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Reset Password
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Enter your registered work email and we will send you a recovery link.
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

          {state?.success && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm animate-in fade-in">
              <CheckCircle2 className="size-5 shrink-0 mt-0.5" />
              <span>{state.success}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Work Email Address</Label>
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
                Sending Recovery Link...
              </>
            ) : (
              state?.success ? 'Send Another Link' : 'Send Reset Link'
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" /> Back to Sign In
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  )
}
