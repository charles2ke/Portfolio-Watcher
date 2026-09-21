import { describe, expect, it } from 'vitest'
import {
  SECTOR_RATE_SENSITIVITY,
  STRESS_SCENARIOS,
  annualisedVolatility,
  buildHoldings,
  concentration,
  correlation,
  correlationMatrix,
  expectedShortfall,
  exposureBy,
  historicalVar,
  maxDrawdown,
  riskHeatMap,
  riskMetrics,
  runStressTests,
  sectorRateSensitivity,
  type Holding,
  type RiskMetrics,
} from './risk'

function makeHolding(overrides: Partial<Holding>): Holding {
  return {
    ticker: 'TEST',
    quantity: 1,
    price: 100,
    value: 100,
    weight: 1,
    sector: 'Information Technology',
    country: 'United States',
    currency: 'USD',
    beta: 1,
    ...overrides,
  }
}

const RICH_TICKERS = ['ARCL', 'HLVT', 'AQFL', 'ORBP', 'TERA', 'SLVM', 'RVRT', 'VLGR']

function richHoldings(): Holding[] {
  return buildHoldings(
    [
      { ticker: 'ARCL', quantity: 50 },
      { ticker: 'HLVT', quantity: 40 },
      { ticker: 'AQFL', quantity: 30 },
      { ticker: 'ORBP', quantity: 20 },
      { ticker: 'TERA', quantity: 60 },
      { ticker: 'SLVM', quantity: 25 },
      { ticker: 'RVRT', quantity: 15 },
      { ticker: 'VLGR', quantity: 35 },
      { ticker: 'ZZZZ', quantity: 10 },
    ],
    10000,
  )
}

describe('buildHoldings', () => {
  it('resolves known tickers, skips unknown and models cash', () => {
    const holdings = buildHoldings([{ ticker: 'ARCL', quantity: 10 }, { ticker: 'ZZZZ', quantity: 5 }], 5000)
    expect(holdings).toHaveLength(2)
    const cash = holdings.find((holding) => holding.ticker === 'CASH')
    expect(cash).toMatchObject({ price: 1, value: 5000, beta: 0, sector: 'Cash', currency: 'USD' })
    const weightSum = holdings.reduce((sum, holding) => sum + holding.weight, 0)
    expect(weightSum).toBeCloseTo(1, 6)
  })

  it('omits cash when not provided and returns zero weights for an empty book', () => {
    const holdings = buildHoldings([{ ticker: 'ARCL', quantity: 10 }])
    expect(holdings.some((holding) => holding.ticker === 'CASH')).toBe(false)
    expect(buildHoldings([{ ticker: 'ZZZZ', quantity: 1 }])).toEqual([])
  })

  it('assigns zero weight when every position has zero value', () => {
    const holdings = buildHoldings([{ ticker: 'ARCL', quantity: 0 }])
    expect(holdings[0].weight).toBe(0)
  })
})

describe('exposureBy and concentration', () => {
  it('groups exposures and sorts descending', () => {
    const holdings = richHoldings()
    const sectors = exposureBy(holdings, 'sector')
    expect(sectors[0].value).toBeGreaterThanOrEqual(sectors[sectors.length - 1].value)
    const totalPercent = sectors.reduce((sum, slice) => sum + slice.percent, 0)
    expect(totalPercent).toBeCloseTo(100, 0)
  })

  it('returns zero percents for an empty portfolio', () => {
    expect(exposureBy([], 'ticker')).toEqual([])
    expect(concentration([])).toEqual({ topPositionPercent: 0, topFivePercent: 0, herfindahl: 0 })
  })

  it('returns zero percents when total value is zero', () => {
    const slices = exposureBy([makeHolding({ ticker: 'A', value: 0 })], 'ticker')
    expect(slices[0].percent).toBe(0)
  })

  it('computes concentration from weights', () => {
    const holdings = [
      makeHolding({ ticker: 'A', weight: 0.5 }),
      makeHolding({ ticker: 'B', weight: 0.3 }),
      makeHolding({ ticker: 'C', weight: 0.2 }),
    ]
    const conc = concentration(holdings)
    expect(conc.topPositionPercent).toBe(50)
    expect(conc.topFivePercent).toBe(100)
    expect(conc.herfindahl).toBeCloseTo(0.38, 6)
  })
})

describe('correlation helpers', () => {
  it('computes Pearson correlation on hand inputs', () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6)
    expect(correlation([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 6)
    expect(correlation([1, 1, 1], [1, 2, 3])).toBe(0)
    expect(correlation([1], [2])).toBe(0)
  })

  it('builds a matrix with unit diagonal and zero for unknown tickers', () => {
    const { tickers, matrix } = correlationMatrix(['ARCL', 'HLVT', 'ZZZZ'])
    expect(tickers).toEqual(['ARCL', 'HLVT', 'ZZZZ'])
    expect(matrix[0][0]).toBe(1)
    expect(matrix[0][2]).toBe(0)
    expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 6)
  })
})

describe('return-series statistics', () => {
  it('annualises volatility', () => {
    expect(annualisedVolatility([0.01, -0.01, 0.02, -0.02])).toBeGreaterThan(0)
  })

  it('computes VaR and expected shortfall', () => {
    const losses = [-0.05, -0.02, 0, 0.01, 0.03]
    expect(historicalVar(losses, 0.95)).toBeCloseTo(0.05, 6)
    expect(expectedShortfall(losses, 0.95)).toBeCloseTo(0.05, 6)
    expect(historicalVar([], 0.95)).toBe(0)
    expect(expectedShortfall([], 0.95)).toBe(0)
    expect(historicalVar([0.01, 0.02, 0.03, 0.04], 0.95)).toBe(0)
    expect(expectedShortfall([0.01, 0.02, 0.03, 0.04], 0.95)).toBe(0)
  })

  it('computes maximum drawdown', () => {
    expect(maxDrawdown([0.1, -0.5, 0.2])).toBeCloseTo(0.5, 6)
    expect(maxDrawdown([])).toBe(0)
  })
})

describe('sectorRateSensitivity', () => {
  it('maps known sectors and falls back for unknown', () => {
    expect(sectorRateSensitivity('Utilities')).toBe(SECTOR_RATE_SENSITIVITY.Utilities)
    expect(sectorRateSensitivity('Mystery sector')).toBe(3)
  })
})

describe('riskMetrics', () => {
  it('produces metrics for a funded portfolio', () => {
    const metrics = riskMetrics(richHoldings())
    expect(metrics.annualVolatility).toBeGreaterThan(0)
    expect(metrics.liquidityDays).not.toBeNull()
    expect(metrics.rateSensitivity).toBeGreaterThan(0)
    expect(typeof metrics.sharpeLike).toBe('number')
    expect(metrics.beta).toBeGreaterThan(0)
  })

  it('handles an empty portfolio and missing volume data', () => {
    const empty = riskMetrics([])
    expect(empty.annualVolatility).toBe(0)
    expect(empty.sharpeLike).toBe(0)
    expect(empty.liquidityDays).toBeNull()

    const synthetic = riskMetrics([
      makeHolding({ ticker: 'ARCL', weight: 0.5 }),
      makeHolding({ ticker: 'ZZZZ', weight: 0.5, sector: 'Mystery' }),
    ])
    expect(synthetic.liquidityDays).not.toBeNull()
    expect(synthetic.rateSensitivity).toBeGreaterThan(0)
  })
})

describe('stress testing', () => {
  it('exposes eight sector/currency-aware scenarios', () => {
    expect(STRESS_SCENARIOS).toHaveLength(8)
    for (const scenario of STRESS_SCENARIOS) {
      expect(scenario.description.toLowerCase()).toContain('estimated')
    }
  })

  it('runs stress tests across the portfolio', () => {
    const results = runStressTests(richHoldings())
    expect(results).toHaveLength(8)
    const equity = results.find((result) => result.id === 'equity-decline')
    expect(equity?.portfolioImpactPercent).toBeLessThan(0)
    expect(equity?.worstHoldings.length).toBe(3)
  })

  it('handles an empty portfolio', () => {
    const results = runStressTests([])
    expect(results[0].portfolioImpactPercent).toBe(0)
    expect(results[0].portfolioImpactValue).toBe(0)
    expect(results[0].worstHoldings).toEqual([])
  })
})

describe('riskHeatMap', () => {
  const holdings = richHoldings()

  function metricsWith(overrides: Partial<RiskMetrics>): RiskMetrics {
    return {
      annualVolatility: 10,
      beta: 1,
      maxDrawdown: 12,
      valueAtRisk95: 3,
      expectedShortfall95: 4,
      sharpeLike: 0.5,
      liquidityDays: 1,
      rateSensitivity: 2,
      ...overrides,
    }
  }

  it('flags high, medium and low severities', () => {
    const high = riskHeatMap(holdings, metricsWith({ annualVolatility: 30, rateSensitivity: 7, liquidityDays: 10 }))
    expect(high.find((row) => row.risk === 'Volatility and drawdown')?.severity).toBe('high')
    expect(high.find((row) => row.risk === 'Interest rate sensitivity')?.severity).toBe('high')
    expect(high.find((row) => row.risk === 'Liquidity')?.severity).toBe('high')

    const medium = riskHeatMap(holdings, metricsWith({ annualVolatility: 20, rateSensitivity: 5, liquidityDays: 3 }))
    expect(medium.find((row) => row.risk === 'Volatility and drawdown')?.severity).toBe('medium')

    const low = riskHeatMap(holdings, metricsWith({}))
    expect(low.find((row) => row.risk === 'Volatility and drawdown')?.severity).toBe('low')
    for (const row of low) {
      expect(row.mitigation.toLowerCase()).toContain('estimate')
    }
  })

  it('handles missing liquidity data and an empty portfolio', () => {
    const nullLiquidity = riskHeatMap(holdings, metricsWith({ liquidityDays: null }))
    const liquidityRow = nullLiquidity.find((row) => row.risk === 'Liquidity')
    expect(liquidityRow?.severity).toBe('medium')
    expect(liquidityRow?.exposure.toLowerCase()).toContain('unavailable')

    const empty = riskHeatMap([], metricsWith({ liquidityDays: null }))
    expect(empty.find((row) => row.risk === 'Sector concentration')?.contributors).toEqual([])
  })
})

describe('universe coverage guard', () => {
  it('resolves every rich ticker', () => {
    for (const ticker of RICH_TICKERS) {
      expect(buildHoldings([{ ticker, quantity: 1 }])).toHaveLength(1)
    }
  })
})
