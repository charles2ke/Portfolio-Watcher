import { STORAGE_KEYS, readJSON, writeJSON } from './storage'
import type { Theme } from './types'

export function prefersDark(): boolean {
  if (typeof globalThis.matchMedia !== 'function') return false
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches
}

export function initialTheme(): Theme {
  const stored = readJSON<Theme | null>(STORAGE_KEYS.theme, null)
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark() ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  globalThis.document.documentElement.setAttribute('data-theme', theme)
  writeJSON(STORAGE_KEYS.theme, theme)
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}
