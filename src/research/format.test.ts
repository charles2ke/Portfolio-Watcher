import { describe, expect, it } from 'vitest'
import {
  NOT_AVAILABLE,
  describeProvenance,
  formatCompact,
  formatCurrency,
  formatNumber,
  formatPercent,
  freshnessDays,
  freshnessLabel,
} from './format'
import type { Provenance } from './types'

const provenance: Provenance = {
  provider: 'Sample provider',
  source: 'bundled-sample-v1',
  asOf: '2026-09-18',
  retrievedAt: '2026-09-18T21:05:00.000Z',
  currency: 'USD',
}

describe('formatting helpers', () => {
  it('formats currency, percentages and numbers', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('1,234.50 USD')
    expect(formatCurrency(1234.5, 'JPY', 0)).toBe('1,235 JPY')
    expect(formatPercent(12.345)).toBe('12.35%')
    expect(formatPercent(null)).toBe('n/a')
    expect(formatPercent(Number.NaN)).toBe('n/a')
    expect(formatNumber(1234.567, 1)).toBe('1,234.6')
    expect(formatNumber(null)).toBe('n/a')
    expect(formatNumber(Number.NaN)).toBe('n/a')
  })

  it('formats compact millions, billions and trillions', () => {
    expect(formatCompact(420)).toBe('420.0M')
    expect(formatCompact(4_200)).toBe('4.20B')
    expect(formatCompact(4_200_000, 'USD')).toBe('4.20T USD')
    expect(formatCompact(null)).toBe('n/a')
    expect(formatCompact(Number.NaN)).toBe('n/a')
  })

  it('describes provenance and freshness', () => {
    expect(describeProvenance(provenance)).toContain('as of 2026-09-18')
    expect(freshnessDays(provenance, new Date('2026-09-19T00:00:00.000Z'))).toBe(1)
    expect(freshnessDays(provenance, new Date('2026-09-01T00:00:00.000Z'))).toBe(0)
    expect(freshnessLabel(0)).toBe('live')
    expect(freshnessLabel(4)).toBe('recent')
    expect(freshnessLabel(30)).toBe('stale')
    expect(NOT_AVAILABLE).toContain('Not available')
  })
})
