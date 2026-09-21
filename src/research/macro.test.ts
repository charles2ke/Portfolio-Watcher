import { describe, expect, it } from 'vitest'
import {
  FACTOR_LABELS,
  MACRO_CALENDAR,
  MACRO_SCENARIOS,
  MACRO_SERIES,
  changeOver,
  exposureMap,
  getSeries,
  latestValue,
  scenarioImpact,
  yieldCurveSpread,
} from './macro'

const holdings = [
  { ticker: 'ARCL', sector: 'Information Technology', weight: 50 },
  { ticker: 'AQFL', sector: 'Utilities', weight: 30 },
  { ticker: 'XXXX', sector: 'Unknown sector', weight: 20 },
]

describe('macro intelligence', () => {
  it('builds monthly observed series with provenance', () => {
    expect(MACRO_SERIES).toHaveLength(15)
    const cpi = getSeries('cpi')!
    expect(cpi.points).toHaveLength(36)
    expect(cpi.provenance.source).toBe('bundled-macro-v1')
    expect(latestValue(cpi)).toBe(2.4)
    expect(getSeries('nope')).toBeUndefined()
  })

  it('computes changes and returns null when history is too short', () => {
    const cpi = getSeries('cpi')!
    expect(changeOver(cpi, 12)).toBeCloseTo(latestValue(cpi) - cpi.points[23].value, 2)
    expect(changeOver(cpi, 48)).toBeNull()
  })

  it('computes the yield-curve spread', () => {
    expect(yieldCurveSpread()).toBeCloseTo(4.05 - 3.45, 2)
    expect(yieldCurveSpread('nope', 'yield-2y')).toBeNull()
    expect(yieldCurveSpread('yield-10y', 'nope')).toBeNull()
  })

  it('publishes a macro calendar', () => {
    expect(MACRO_CALENDAR.some((event) => event.importance === 'high')).toBe(true)
  })

  it('maps macro factors to holdings', () => {
    const rows = exposureMap(holdings)
    expect(rows).toHaveLength(Object.keys(FACTOR_LABELS).length)
    const rates = rows.find((row) => row.factor === 'policy-rates')!
    expect(rates.holdings.find((holding) => holding.ticker === 'XXXX')!.sensitivity).toBe(0)
    expect(rates.sensitivity).toBeLessThan(0)
    expect(rates.mechanism).toContain('Discount rate')
    expect(exposureMap([])[0].sensitivity).toBe(0)
    expect(exposureMap([{ ...holdings[0], weight: 0 }])[0].sensitivity).toBe(0)
  })

  it('estimates scenario impact without presenting it as a forecast', () => {
    const recession = scenarioImpact(holdings, 'recession')!
    expect(recession.label).toBe('Recession')
    expect(recession.estimatedImpactPercent).toBeLessThan(0)
    expect(recession.holdings).toHaveLength(3)
    expect(recession.disclaimer).toContain('not a forecast')
    expect(scenarioImpact([], 'recession')!.estimatedImpactPercent).toBe(0)
    expect(scenarioImpact(holdings, 'nope')).toBeNull()
    expect(MACRO_SCENARIOS).toHaveLength(7)
  })
})
