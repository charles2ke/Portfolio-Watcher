import type { Quote } from './types'
import { percentChange, roundTo } from './numbers'
import { isSecureEndpoint } from './endpoints'

/** Market data vendors the app can talk to directly from the browser. */
export type QuoteProvider = 'finnhub' | 'alphavantage' | 'custom'

export interface QuoteSource {
  provider: QuoteProvider
  /** Request URL for a single symbol. */
  url: (symbol: string) => string
  /** Maps a vendor payload onto the app's `Quote` shape, or `null` when unusable. */
  parse: (payload: unknown, symbol: string) => Quote | null
}

function record(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function buildQuote(
  symbol: string,
  price: number,
  previousClose: number,
  currency: string,
  series: number[],
): Quote {
  return {
    symbol,
    price,
    previousClose,
    changePercent: roundTo(percentChange(previousClose, price)),
    currency,
    series,
  }
}

/**
 * Finnhub `/quote` returns the live price (`c`) and the previous close (`pc`)
 * but no intraday series, so the sparkline is drawn from the day's open, low,
 * high and current price.
 */
export function parseFinnhub(payload: unknown, symbol: string): Quote | null {
  const data = record(payload)
  if (!data) return null
  const price = numeric(data.c)
  const previousClose = numeric(data.pc)
  if (price === null || price === 0 || previousClose === null || previousClose === 0) return null
  const series = [previousClose, numeric(data.o), numeric(data.l), numeric(data.h), price]
    .filter((value): value is number => value !== null && value !== 0)
  return buildQuote(symbol, price, previousClose, 'USD', series)
}

/**
 * Alpha Vantage `GLOBAL_QUOTE` returns the live price and previous close for a
 * single symbol directly, avoiding the ambiguity of guessing a trading-day
 * boundary from an intraday candle series; the sparkline is built from the
 * day's open, low, high and current price, mirroring the Finnhub adapter.
 */
export function parseAlphaVantage(payload: unknown, symbol: string): Quote | null {
  const data = record(payload)
  if (!data) return null
  const quote = record(data['Global Quote'])
  if (!quote) return null
  const price = numeric(quote['05. price'])
  const previousClose = numeric(quote['08. previous close'])
  if (price === null || previousClose === null) return null
  const series = [
    previousClose,
    numeric(quote['02. open']),
    numeric(quote['04. low']),
    numeric(quote['03. high']),
    price,
  ].filter((value): value is number => value !== null && value !== 0)
  return buildQuote(symbol, price, previousClose, 'USD', series)
}

interface CustomPayload {
  price?: unknown
  previousClose?: unknown
  currency?: unknown
  series?: unknown
}

/** The app's own quote contract, used by `VITE_QUOTE_API_URL` backends. */
export function parseCustom(payload: unknown, symbol: string): Quote | null {
  const data = record(payload) as CustomPayload | null
  if (!data) return null
  const price = typeof data.price === 'number' ? data.price : null
  const series = Array.isArray(data.series)
    ? data.series.filter((value): value is number => typeof value === 'number')
    : []
  if (price === null || series.length === 0) return null
  const previousClose = typeof data.previousClose === 'number' ? data.previousClose : series[0]
  const currency = typeof data.currency === 'string' ? data.currency : 'USD'
  return buildQuote(symbol, price, previousClose, currency, series)
}

/**
 * Resolves the configured market data integration. `VITE_QUOTE_API_URL` keeps
 * working for self-hosted backends; `VITE_MARKET_PROVIDER` selects a vendor and
 * requires `VITE_MARKET_API_KEY`. Returns `null` in demo mode.
 */
export function resolveQuoteSource(env: Record<string, string | undefined>): QuoteSource | null {
  const apiUrl = env.VITE_QUOTE_API_URL?.trim()
  if (apiUrl && isSecureEndpoint(apiUrl)) {
    return {
      provider: 'custom',
      url: (symbol) => `${apiUrl}${encodeURIComponent(symbol)}`,
      parse: parseCustom,
    }
  }
  const provider = env.VITE_MARKET_PROVIDER?.trim().toLowerCase()
  const apiKey = env.VITE_MARKET_API_KEY
  if (!apiKey) return null
  if (provider === 'finnhub') {
    return {
      provider: 'finnhub',
      url: (symbol) =>
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`,
      parse: parseFinnhub,
    }
  }
  if (provider === 'alphavantage') {
    return {
      provider: 'alphavantage',
      url: (symbol) =>
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`,
      parse: parseAlphaVantage,
    }
  }
  return null
}
