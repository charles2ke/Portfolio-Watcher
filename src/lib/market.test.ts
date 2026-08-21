import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildSparklinePath,
  fetchQuote,
  hashSymbol,
  isValidSymbol,
  normalizeSymbol,
  percentChange,
  roundTo,
  syntheticQuote,
} from './market'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('market helpers', () => {
  it('normalizes and validates symbols', () => {
    expect(normalizeSymbol('  msft ')).toBe('MSFT')
    expect(isValidSymbol('brk.b')).toBe(true)
    expect(isValidSymbol('')).toBe(false)
    expect(isValidSymbol('123')).toBe(false)
    expect(isValidSymbol('TOOLONGSYMBOL')).toBe(false)
  })

  it('hashes symbols deterministically', () => {
    expect(hashSymbol('MSFT')).toBe(hashSymbol('msft'))
    expect(hashSymbol('MSFT')).not.toBe(hashSymbol('AAPL'))
  })

  it('computes percentage change and rounding', () => {
    expect(percentChange(100, 110)).toBe(10)
    expect(percentChange(0, 10)).toBe(0)
    expect(roundTo(1.23456)).toBe(1.23)
    expect(roundTo(1.23456, 3)).toBe(1.235)
  })

  it('creates a reproducible synthetic quote', () => {
    const first = syntheticQuote('MSFT')
    const second = syntheticQuote('msft')
    expect(second).toEqual(first)
    expect(first.series).toHaveLength(40)
    expect(first.currency).toBe('USD')
    expect(syntheticQuote('MSFT', 1).series).not.toEqual(first.series)
  })

  it('builds sparkline points', () => {
    expect(buildSparklinePath([], 100, 50)).toBe('')
    expect(buildSparklinePath([5], 100, 50)).toBe('0,50')
    expect(buildSparklinePath([1, 2, 3], 100, 50)).toBe('0,50 50,25 100,0')
    expect(buildSparklinePath([2, 2], 100, 50)).toBe('0,50 100,50')
  })
})

describe('fetchQuote', () => {
  it('returns synthetic data when no API is configured', async () => {
    const quote = await fetchQuote('MSFT')
    expect(quote).toEqual(syntheticQuote('MSFT'))
  })

  it('uses the configured API response', async () => {
    vi.stubEnv('VITE_QUOTE_API_URL', 'https://api.example/quote/')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ price: 110, previousClose: 100, currency: 'EUR', series: [100, 110] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const quote = await fetchQuote('msft')
    expect(fetchMock).toHaveBeenCalledWith('https://api.example/quote/MSFT')
    expect(quote).toEqual({
      symbol: 'MSFT',
      price: 110,
      previousClose: 100,
      changePercent: 10,
      currency: 'EUR',
      series: [100, 110],
    })
  })

  it('defaults previousClose and currency from the series', async () => {
    vi.stubEnv('VITE_QUOTE_API_URL', 'https://api.example/quote/')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ price: 120, series: [100, 120] }) }),
    )
    const quote = await fetchQuote('MSFT')
    expect(quote.previousClose).toBe(100)
    expect(quote.currency).toBe('USD')
    expect(quote.changePercent).toBe(20)
  })

  it('falls back when the response is not ok', async () => {
    vi.stubEnv('VITE_QUOTE_API_URL', 'https://api.example/quote/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchQuote('MSFT')).toEqual(syntheticQuote('MSFT'))
  })

  it('falls back when the payload is incomplete', async () => {
    vi.stubEnv('VITE_QUOTE_API_URL', 'https://api.example/quote/')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await fetchQuote('MSFT')).toEqual(syntheticQuote('MSFT'))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ price: 10, series: [] }) }),
    )
    expect(await fetchQuote('MSFT')).toEqual(syntheticQuote('MSFT'))
  })

  it('falls back when the request throws', async () => {
    vi.stubEnv('VITE_QUOTE_API_URL', 'https://api.example/quote/')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await fetchQuote('MSFT')).toEqual(syntheticQuote('MSFT'))
  })
})
