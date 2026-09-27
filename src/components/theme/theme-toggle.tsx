'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import {
  THEME_CHANGE_EVENT,
  applyTheme,
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from './theme'

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = () => {
    if (readThemePreference() === 'system') applyTheme('system')
    onChange()
  }
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  media.addEventListener('change', onSystemChange)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
    media.removeEventListener('change', onSystemChange)
  }
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readThemePreference, () => 'system')
}

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Three-way Light / Dark / System segmented control (used in the account menu). */
export function ThemeSegmentedControl() {
  const preference = useThemePreference()

  // Another tab changed the preference: re-apply it here too.
  useEffect(() => applyTheme(preference), [preference])

  return (
    <div role="radiogroup" aria-label="Color theme" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setThemePreference(value)}
            className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              selected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

/** One-click light/dark switch for the header. */
export function ThemeToggleButton() {
  const toggle = () => {
    const isDark = document.documentElement.classList.contains('dark')
    setThemePreference(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      aria-label="Toggle light or dark theme"
      title="Toggle light / dark theme"
    >
      <Sun className="size-4 hidden dark:block" />
      <Moon className="size-4 dark:hidden" />
    </button>
  )
}
