import { describe, expect, it } from 'vitest'
import {
  analyseEarnings,
  analyseQuarter,
  average,
  compareGuidance,
  impliedMove,
  summariseQuarters,
  upcomingEarnings,
} from './earnings'
import type { EarningsQuarter } from './types'

const quarter: EarningsQuarter = {
  period: 'Q2 2026',
  reportDate: '2026-07-24',
  epsReported: 1.1,
  epsConsensus: 1,
  revenueReported: 1100,
  revenueConsensus: 1000,
  priceReactionPercent: 3.2,
}

describe('earnings analyzer', () => {
  it('computes EPS and revenue surprises', () => {
    const analysed = analyseQuarter(quarter)
    expect(analysed.epsSurprisePercent).toBe(10)
    expect(analysed.revenueSurprisePercent).toBe(10)
  })

  it('treats a zero consensus as no surprise rather than dividing by zero', () => {
    const analysed = analyseQuarter({ ...quarter, epsConsensus: 0, revenueConsensus: 0 })
    expect(analysed.epsSurprisePercent).toBe(0)
    expect(analysed.revenueSurprisePercent).toBe(0)
  })

  it('compares guidance with consensus and flags unknown consensus', () => {
    expect(compareGuidance({ metric: 'Revenue', low: 100, high: 120, consensus: 100, unit: 'm' }).verdict).toBe(
      'above',
    )
    expect(compareGuidance({ metric: 'Revenue', low: 90, high: 100, consensus: 110, unit: 'm' }).verdict).toBe(
      'below',
    )
    expect(compareGuidance({ metric: 'Revenue', low: 99, high: 101, consensus: 100, unit: 'm' }).verdict).toBe(
      'in-line',
    )
    const unknown = compareGuidance({ metric: 'Revenue', low: 99, high: 101, consensus: null, unit: 'm' })
    expect(unknown.verdict).toBe('unknown')
    expect(unknown.versusConsensusPercent).toBeNull()
    expect(compareGuidance({ metric: 'Revenue', low: 1, high: 2, consensus: 0, unit: 'm' }).verdict).toBe(
      'unknown',
    )
  })

  it('derives the implied move only when options data exists', () => {
    expect(impliedMove('ARCL')).toBeGreaterThan(0)
    expect(impliedMove('AQFL')).toBeNull()
    expect(impliedMove('NOPE')).toBeNull()
  })

  it('builds a full analysis with bull, base and bear scenarios', () => {
    const analysis = analyseEarnings('ARCL')!
    expect(analysis.quarters).toHaveLength(4)
    expect(analysis.beatRatePercent).toBeGreaterThanOrEqual(0)
    expect(analysis.impliedMovePercent).not.toBeNull()
    expect(analysis.scenarios.map((scenario) => scenario.name)).toEqual(['bull', 'base', 'bear'])
    expect(analysis.scenarios[0].epsEstimate).toBeGreaterThan(analysis.scenarios[2].epsEstimate)
    expect(analysis.guidance.length).toBeGreaterThan(0)
    expect(analysis.kpis.length).toBeGreaterThan(0)
  })

  it('falls back to the historical reaction when there is no options data', () => {
    const analysis = analyseEarnings('AQFL')!
    expect(analysis.impliedMovePercent).toBeNull()
    expect(analysis.scenarios[0].priceReactionPercent).toBe(analysis.averageAbsoluteReactionPercent)
    expect(analyseEarnings('NOPE')).toBeNull()
  })

  it('summarises an empty quarter history without inventing numbers', () => {
    expect(average([])).toBe(0)
    expect(summariseQuarters([])).toEqual({
      averageEpsSurprisePercent: 0,
      beatRatePercent: 0,
      averageAbsoluteReactionPercent: 0,
    })
  })

  it('orders upcoming earnings and skips unknown tickers', () => {
    const upcoming = upcomingEarnings(['NBLA', 'ARCL', 'NOPE'])
    expect(upcoming.map((entry) => entry.ticker)).toEqual(['ARCL', 'NBLA'])
  })
})
