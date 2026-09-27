'use client'

import React, { useState } from 'react'
import { Check, Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Show the live requirements checklist (for new passwords) */
  showRules?: boolean
}

const RULES: Array<{ label: string; test: (v: string) => boolean }> = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'A letter', test: (v) => /[A-Za-z]/.test(v) },
  { label: 'A number', test: (v) => /\d/.test(v) },
]

/** Password field with a show/hide toggle and optional requirements checklist. */
export function PasswordInput({ showRules = false, className = '', onChange, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const [value, setValue] = useState('')

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          {...props}
          type={visible ? 'text' : 'password'}
          onChange={(e) => {
            setValue(e.target.value)
            onChange?.(e)
          }}
          className={`pr-10 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {showRules && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-live="polite">
          {RULES.map((r) => {
            const ok = r.test(value)
            return (
              <li
                key={r.label}
                className={`inline-flex items-center gap-1 ${ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}`}
              >
                <Check className={`size-3 ${ok ? 'opacity-100' : 'opacity-30'}`} />
                {r.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
