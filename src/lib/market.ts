import type { Quote } from './types'

const POINTS = 40

/** Deterministic hash so a symbol always renders the same demo series. */
export function hashSymbol(symbol: string): number {
  let hash = 2166136261
  for (const char of symbol.toUpperCase()) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase()
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(normalizeSymbol(symbol))
}

export function percentChange(from: number, to: number): number {
  if (from === 0) return 0
  return ((to - from) / from) * 100
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Builds a reproducible price series for a symbol (used as offline data). */
export function syntheticQuote(symbol: string, seedOffset = 0): Quote {
  const normalized = normalizeSymbol(symbol)
  const random = mulberry32(hashSymbol(normalized) + seedOffset)
  const base = 20 + (hashSymbol(normalized) % 480)
  const series: number[] = []
  let price = base
  for (let i = 0; i < POINTS; i += 1) {
    price = Math.max(1, price * (1 + (random() - 0.5) * 0.035))
    series.push(roundTo(price))
  }
  const previousClose = series[0]
  const last = series[series.length - 1]
  return {
    symbol: normalized,
    price: last,
    previousClose,
    changePercent: roundTo(percentChange(previousClose, last)),
    currency: 'USD',
    series,
  }
}

interface QuoteApiResponse {
  price?: number
  previousClose?: number
  currency?: string
  series?: number[]
}

/**
 * Fetches a quote from an optional quote API. Falls back to the deterministic
 * synthetic series whenever no API is configured or the request fails, so the
 * static site always renders data.
 */
export async function fetchQuote(symbol: string, seedOffset = 0): Promise<Quote> {
  const env = import.meta.env as Record<string, string | undefined>
  const apiUrl = env.VITE_QUOTE_API_URL
  const normalized = normalizeSymbol(symbol)
  if (!apiUrl) return syntheticQuote(normalized, seedOffset)
  try {
    const response = await fetch(`${apiUrl}${encodeURIComponent(normalized)}`)
    if (!response.ok) return syntheticQuote(normalized, seedOffset)
    const data = (await response.json()) as QuoteApiResponse
    const series = Array.isArray(data.series) && data.series.length > 0 ? data.series : null
    if (typeof data.price !== 'number' || !series) return syntheticQuote(normalized, seedOffset)
    const previousClose =
      typeof data.previousClose === 'number' ? data.previousClose : series[0]
    return {
      symbol: normalized,
      price: data.price,
      previousClose,
      changePercent: roundTo(percentChange(previousClose, data.price)),
      currency: data.currency ?? 'USD',
      series,
    }
  } catch {
    return syntheticQuote(normalized, seedOffset)
  }
}

/** Converts a price series into an SVG polyline path within a viewbox. */
export function buildSparklinePath(series: number[], width: number, height: number): string {
  if (series.length === 0) return ''
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const step = series.length > 1 ? width / (series.length - 1) : 0
  return series
    .map((value, index) => {
      const x = roundTo(index * step, 2)
      const y = roundTo(height - ((value - min) / span) * height, 2)
      return `${x},${y}`
    })
    .join(' ')
}
