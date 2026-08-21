import { describe, expect, it, vi } from 'vitest'
import { initialTheme, applyTheme, nextTheme, prefersDark } from './theme'
import { STORAGE_KEYS, writeJSON } from './storage'

describe('theme', () => {
  it('reports no dark preference when matchMedia is unavailable', () => {
    expect(prefersDark()).toBe(false)
  })

  it('reads the system preference when matchMedia exists', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal('matchMedia', matchMedia)
    expect(prefersDark()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    vi.unstubAllGlobals()
  })

  it('prefers the stored theme', () => {
    writeJSON(STORAGE_KEYS.theme, 'dark')
    expect(initialTheme()).toBe('dark')
    writeJSON(STORAGE_KEYS.theme, 'light')
    expect(initialTheme()).toBe('light')
  })

  it('falls back to the system preference', () => {
    expect(initialTheme()).toBe('light')
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    expect(initialTheme()).toBe('dark')
    vi.unstubAllGlobals()
  })

  it('ignores unknown stored values', () => {
    writeJSON(STORAGE_KEYS.theme, 'neon')
    expect(initialTheme()).toBe('light')
  })

  it('applies the theme to the document and persists it', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(initialTheme()).toBe('dark')
  })

  it('toggles between themes', () => {
    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('light')).toBe('dark')
  })
})
