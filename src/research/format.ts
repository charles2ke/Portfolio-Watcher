import type { Provenance } from './types'

/** Formatting helpers shared by every module that displays sourced data. */

export function formatCurrency(value: number, currency: string, decimals = 2): string {
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`
}

export function formatPercent(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) return 'n/a'
  return `${value.toFixed(decimals)}%`
}

export function formatNumber(value: number | null, decimals = 2): string {
  if (value === null || Number.isNaN(value)) return 'n/a'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatCompact(value: number | null, currency?: string): string {
  if (value === null || Number.isNaN(value)) return 'n/a'
  const suffix = currency ? ` ${currency}` : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}T${suffix}`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}B${suffix}`
  return `${value.toFixed(1)}M${suffix}`
}

export function describeProvenance(provenance: Provenance): string {
  return `${provenance.provider} · ${provenance.source} · as of ${provenance.asOf} · retrieved ${provenance.retrievedAt.slice(0, 10)} · ${provenance.currency}`
}

/** Age of a record in whole days, used for freshness badges. */
export function freshnessDays(provenance: Provenance, now: Date): number {
  const asOf = new Date(`${provenance.asOf}T00:00:00.000Z`).getTime()
  return Math.max(0, Math.floor((now.getTime() - asOf) / 86_400_000))
}

export function freshnessLabel(days: number): 'live' | 'recent' | 'stale' {
  if (days <= 1) return 'live'
  if (days <= 7) return 'recent'
  return 'stale'
}

/** Explicit marker so missing data is displayed rather than silently invented. */
export const NOT_AVAILABLE = 'Not available in the connected data sources'
