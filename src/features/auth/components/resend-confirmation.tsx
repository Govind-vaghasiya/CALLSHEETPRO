'use client'

import { useState, useTransition } from 'react'
import { Loader2, MailCheck } from 'lucide-react'
import { resendConfirmationAction, type AuthState } from '../actions'

/**
 * "Didn't get the email? Resend" — for sign-up confirmation links.
 * A plain button (not a <form>) so it can sit inside the sign-in / sign-up forms.
 */
export function ResendConfirmation({ email }: { email?: string }) {
  const [state, setState] = useState<AuthState>({})
  const [isPending, startTransition] = useTransition()
  if (!email) return null

  const resend = () =>
    startTransition(async () => {
      const fd = new FormData()
      fd.set('email', email)
      setState(await resendConfirmationAction(null, fd))
    })

  return (
    <div className="text-sm space-y-1.5">
      {state.success ? (
        <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <MailCheck className="size-4 shrink-0" /> {state.success}
        </p>
      ) : (
        <p className="text-muted-foreground">
          Didn&apos;t get the email? Check spam, or{' '}
          <button
            type="button"
            onClick={resend}
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
    </div>
  )
}
