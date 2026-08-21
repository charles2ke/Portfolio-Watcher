import { describe, expect, it, vi } from 'vitest'
import {
  createWatch,
  loadWatches,
  removeWatch,
  saveWatches,
  toggleChannel,
  validateDraft,
} from './watchlist'
import type { WatchDraft } from './watchlist'
import { STORAGE_KEYS, writeJSON } from './storage'
import type { Watch } from './types'

const draft = (overrides: Partial<WatchDraft> = {}): WatchDraft => ({
  symbol: 'msft',
  dipPercent: 5,
  risePercent: 5,
  channels: ['email'],
  destination: ' me@example.com ',
  ...overrides,
})

describe('createWatch', () => {
  it('normalizes the draft', () => {
    const watch = createWatch(draft(), 'id-1')
    expect(watch).toEqual({
      id: 'id-1',
      symbol: 'MSFT',
      dipPercent: 5,
      risePercent: 5,
      channels: ['email'],
      destination: 'me@example.com',
    })
  })
})

describe('validateDraft', () => {
  const existing: Watch[] = [createWatch(draft({ symbol: 'AAPL' }), 'a')]

  it('accepts a valid draft', () => {
    expect(validateDraft(draft(), existing)).toBeNull()
  })

  it('rejects invalid symbols', () => {
    expect(validateDraft(draft({ symbol: '123' }), existing)).toMatch(/valid ticker/)
  })

  it('rejects duplicates', () => {
    expect(validateDraft(draft({ symbol: 'aapl' }), existing)).toMatch(/already/)
  })

  it('requires a threshold', () => {
    expect(validateDraft(draft({ dipPercent: 0, risePercent: 0 }), existing)).toMatch(/greater/)
  })

  it('rejects negative percentages', () => {
    expect(validateDraft(draft({ dipPercent: -1, risePercent: 2 }), existing)).toMatch(/negative/)
  })

  it('requires a channel', () => {
    expect(validateDraft(draft({ channels: [] }), existing)).toMatch(/channel/)
  })
})

describe('persistence', () => {
  it('saves and loads watches', () => {
    const watches = [createWatch(draft(), 'id-1')]
    saveWatches(watches)
    expect(loadWatches()).toEqual(watches)
  })

  it('returns an empty list when nothing is stored', () => {
    expect(loadWatches()).toEqual([])
  })

  it('ignores corrupted storage payloads', () => {
    writeJSON(STORAGE_KEYS.watches, { not: 'an array' })
    expect(loadWatches()).toEqual([])
  })

  it('never throws when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => saveWatches([])).not.toThrow()
    spy.mockRestore()
  })
})

describe('mutations', () => {
  it('removes by id', () => {
    const watches = [createWatch(draft(), 'a'), createWatch(draft({ symbol: 'TSLA' }), 'b')]
    expect(removeWatch(watches, 'a').map((w) => w.id)).toEqual(['b'])
  })

  it('toggles channels on and off', () => {
    expect(toggleChannel(['email'], 'sms')).toEqual(['email', 'sms'])
    expect(toggleChannel(['email', 'sms'], 'email')).toEqual(['sms'])
  })
})
