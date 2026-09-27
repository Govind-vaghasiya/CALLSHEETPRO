'use client'

import { useActionState } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { resendConfirmationAction, type AuthState } from '../actions'

/** "Didn't get the email? Resend" — for sign-up confirmation links. */
export function ResendConfirmation({ email }: { email?: string }) {
  const [state, action, isPending] = useActionState<AuthState, FormData>(resendConfirmationAction, {})
  if (!email) return null
  return (
    <form action={action} className="text-sm space-y-1.5">
      <input type="hidden" name="email" value={email} />
      {state.success ? (
        <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <MailCheck className="size-4" /> {state.success}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Didn&apos;t get the email? Check spam, or{' '}
          <button
            type="submit"
            disabled={isPending}
            className="font-medium text-amber-700 dark:text-amber-400 underline underline-offset-4 cursor-pointer disabled:opacity-60"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> sending…
              </span>
            ) : (
              'resend the confirmation link'
            )}
          </button>
          .
        </p>
      )}
      {state.error && <p className="text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  )
}
