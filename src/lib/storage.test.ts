import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, readJSON, remove, writeJSON } from './storage'

describe('storage', () => {
  it('round-trips JSON values', () => {
    writeJSON('key', { a: 1 })
    expect(readJSON('key', null)).toEqual({ a: 1 })
  })

  it('returns the fallback for missing keys', () => {
    expect(readJSON('missing', 'fallback')).toBe('fallback')
  })

  it('returns the fallback for malformed JSON', () => {
    localStorage.setItem('bad', '{not json')
    expect(readJSON('bad', 42)).toBe(42)
  })

  it('returns the fallback when reading throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readJSON('key', 'safe')).toBe('safe')
    spy.mockRestore()
  })

  it('swallows write errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => writeJSON('key', 1)).not.toThrow()
    spy.mockRestore()
  })

  it('removes keys and swallows removal errors', () => {
    writeJSON('key', 1)
    remove('key')
    expect(readJSON('key', null)).toBeNull()
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => remove('key')).not.toThrow()
    spy.mockRestore()
  })

  it('exposes namespaced storage keys', () => {
    expect(STORAGE_KEYS.user).toBe('pw.user')
    expect(STORAGE_KEYS.watches).toBe('pw.watches')
    expect(STORAGE_KEYS.theme).toBe('pw.theme')
  })
})
