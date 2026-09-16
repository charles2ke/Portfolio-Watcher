import { describe, expect, it } from 'vitest'
import {
  parseAlphaVantage,
  parseCustom,
  parseFinnhub,
  resolveQuoteSource,
} from './quoteProviders'

describe('parseFinnhub', () => {
  it('maps a quote payload and builds a series from the day range', () => {
    const quote = parseFinnhub({ c: 110, pc: 100, o: 101, l: 99, h: 112 }, 'MSFT')
    expect(quote).toEqual({
      symbol: 'MSFT',
      price: 110,
      previousClose: 100,
      changePercent: 10,
      currency: 'USD',
      series: [100, 101, 99, 112, 110],
    })
  })

  it('drops missing range values', () => {
    expect(parseFinnhub({ c: 110, pc: 100, o: 0, l: null, h: 'x' }, 'MSFT')?.series).toEqual([
      100, 110,
    ])
  })

  it('rejects unusable payloads', () => {
    expect(parseFinnhub(null, 'MSFT')).toBeNull()
    expect(parseFinnhub([1], 'MSFT')).toBeNull()
    expect(parseFinnhub({ c: 0, pc: 100 }, 'MSFT')).toBeNull()
    expect(parseFinnhub({ c: 10, pc: 0 }, 'MSFT')).toBeNull()
    expect(parseFinnhub({ c: 10 }, 'MSFT')).toBeNull()
  })
})

describe('parseAlphaVantage', () => {
  const payload = {
    'Global Quote': {
      '01. symbol': 'MSFT',
      '02. open': '101.0000',
      '03. high': '112.0000',
      '04. low': '99.0000',
      '05. price': '110.0000',
      '08. previous close': '100.0000',
    },
  }

  it('maps a quote payload and builds a series from the day range', () => {
    expect(parseAlphaVantage(payload, 'MSFT')).toEqual({
      symbol: 'MSFT',
      price: 110,
      previousClose: 100,
      changePercent: 10,
      currency: 'USD',
      series: [100, 101, 99, 112, 110],
    })
  })

  it('drops missing range values', () => {
    const quote = parseAlphaVantage(
      {
        'Global Quote': {
          '05. price': '110.0000',
          '08. previous close': '100.0000',
          '02. open': '0',
          '04. low': null,
          '03. high': 'x',
        },
      },
      'MSFT',
    )
    expect(quote?.series).toEqual([100, 110])
  })

  it('rejects unusable payloads', () => {
    expect(parseAlphaVantage(null, 'MSFT')).toBeNull()
    expect(parseAlphaVantage({ Note: 'rate limited' }, 'MSFT')).toBeNull()
    expect(parseAlphaVantage({ 'Global Quote': {} }, 'MSFT')).toBeNull()
    expect(
      parseAlphaVantage({ 'Global Quote': { '05. price': '0', '08. previous close': '100' } }, 'MSFT'),
    ).toBeNull()
    expect(
      parseAlphaVantage({ 'Global Quote': { '05. price': '110', '08. previous close': '0' } }, 'MSFT'),
    ).toBeNull()
  })
})

describe('parseCustom', () => {
  it('maps the app quote contract', () => {
    expect(parseCustom({ price: 110, previousClose: 100, currency: 'EUR', series: [100, 110] }, 'MSFT')).toEqual({
      symbol: 'MSFT',
      price: 110,
      previousClose: 100,
      changePercent: 10,
      currency: 'EUR',
      series: [100, 110],
    })
  })

  it('defaults previousClose and currency and filters the series', () => {
    const quote = parseCustom({ price: 120, series: [100, 'x', 120] }, 'MSFT')
    expect(quote).toMatchObject({ previousClose: 100, currency: 'USD', series: [100, 120] })
  })

  it('rejects unusable payloads', () => {
    expect(parseCustom(null, 'MSFT')).toBeNull()
    expect(parseCustom({ series: [1] }, 'MSFT')).toBeNull()
    expect(parseCustom({ price: 10 }, 'MSFT')).toBeNull()
    expect(parseCustom({ price: 10, series: [] }, 'MSFT')).toBeNull()
  })
})

describe('resolveQuoteSource', () => {
  it('returns null in demo mode', () => {
    expect(resolveQuoteSource({})).toBeNull()
    expect(resolveQuoteSource({ VITE_MARKET_PROVIDER: 'finnhub' })).toBeNull()
    expect(resolveQuoteSource({ VITE_MARKET_API_KEY: 'key', VITE_MARKET_PROVIDER: 'nope' })).toBeNull()
    expect(resolveQuoteSource({ VITE_MARKET_API_KEY: 'key' })).toBeNull()
  })

  it('prefers a self-hosted quote API', () => {
    const source = resolveQuoteSource({ VITE_QUOTE_API_URL: 'https://api.example/quote/' })
    expect(source?.provider).toBe('custom')
    expect(source?.url('BRK.B')).toBe('https://api.example/quote/BRK.B')
  })

  it('builds Finnhub requests', () => {
    const source = resolveQuoteSource({
      VITE_MARKET_PROVIDER: 'Finnhub',
      VITE_MARKET_API_KEY: 'k e y',
    })
    expect(source?.provider).toBe('finnhub')
    expect(source?.url('MSFT')).toBe('https://finnhub.io/api/v1/quote?symbol=MSFT&token=k%20e%20y')
  })

  it('builds Alpha Vantage requests', () => {
    const source = resolveQuoteSource({
      VITE_MARKET_PROVIDER: 'alphavantage',
      VITE_MARKET_API_KEY: 'key',
    })
    expect(source?.provider).toBe('alphavantage')
    expect(source?.url('MSFT')).toBe(
      'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=key',
    )
  })
})
