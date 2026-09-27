'use client'

import { useActionState, Suspense } from 'react'
import Link from 'next/link'
import { signUpAction, type AuthState } from '@/features/auth/actions'
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
import { Sparkles, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'

function SignUpForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signUpAction,
    {}
  )

  return (
    <Card className="border-border bg-card/90 shadow-2xl backdrop-blur-xl">
      <CardHeader className="space-y-2 pb-6 border-b border-border/60">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-xs font-mono tracking-wider uppercase font-semibold">
          <Sparkles className="size-3.5" /> Start Production
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Create Production Account
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Build accurate film schedules, avoid costly conflicts, and generate industry call sheets.
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
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="Christopher Nolan"
              required
              autoComplete="name"
              className="bg-background/80 border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Work Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="producer@studio.com"
              required
              autoComplete="email"
              className="bg-background/80 border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password (min 8 characters)</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
              className="bg-background/80 border-border focus-visible:ring-amber-500 text-foreground placeholder:text-faint h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
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
                Creating Studio Account...
              </>
            ) : (
              <>
                Continue to Organization Setup
                <ArrowRight className="size-4 ml-2" />
              </>
            )}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-amber-700 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 underline underline-offset-4"
            >
              Sign In
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  )
}
