import { describe, expect, it, vi } from 'vitest'
import { newId } from './ids'

describe('newId', () => {
  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-1' })
    expect(newId()).toBe('uuid-1')
    vi.unstubAllGlobals()
  })

  it('falls back to a random id', () => {
    vi.stubGlobal('crypto', undefined)
    expect(newId()).toMatch(/^w-[a-z0-9]+-[a-z0-9]+$/)
    vi.unstubAllGlobals()
  })

  it('falls back when randomUUID is missing', () => {
    vi.stubGlobal('crypto', {})
    expect(newId()).toMatch(/^w-/)
    vi.unstubAllGlobals()
  })
})
