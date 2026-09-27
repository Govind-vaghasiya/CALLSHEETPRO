export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'callsheetpro-theme'
export const THEME_CHANGE_EVENT = 'callsheetpro-theme-change'

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * Mirrors applyTheme() below; keep the two in sync.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {}
  return 'system'
}

export function applyTheme(preference: ThemePreference) {
  const isDark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

export function setThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {}
  applyTheme(preference)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}
