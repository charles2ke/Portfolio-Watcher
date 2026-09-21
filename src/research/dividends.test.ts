import { describe, expect, it } from 'vitest'
import {
  dividendPortfolio,
  dividendSafety,
  dividendSummary,
  dripScenarios,
  simulateDrip,
  type DividendSummary,
} from './dividends'

function summary(overrides: Partial<DividendSummary>): DividendSummary {
  return {
    ticker: 'TEST',
    yieldPercent: 3,
    annualDividend: 3,
    paymentsPerYear: 4,
    exDividendDate: '2026-11-06',
    payoutRatio: 0.5,
    fcfPayoutRatio: 0.5,
    consecutiveGrowthYears: 5,
    cagr3y: 0.03,
    cagr5y: 0.03,
    cagr10y: null,
    lastCutYear: null,
    netDebtToEbitda: 1,
    ...overrides,
  }
}

describe('dividendSummary', () => {
  it('summarises a dividend payer', () => {
    const result = dividendSummary('MDCR')
    expect(result).not.toBeNull()
    expect(result?.ticker).toBe('MDCR')
    expect(result?.annualDividend).toBe(3.6)
    expect(result?.paymentsPerYear).toBe(4)
    expect(result?.yieldPercent).toBe(2.54)
    expect(result?.netDebtToEbitda).toBe(0.62)
    expect(result?.lastCutYear).toBeNull()
  })

  it('returns null for a non-payer', () => {
    expect(dividendSummary('NBLA')).toBeNull()
  })

  it('returns null for an unknown ticker', () => {
    expect(dividendSummary('ZZZ')).toBeNull()
  })
})

describe('dividendSafety', () => {
  it('scores a strong payer with every strong verdict', () => {
    const assessment = dividendSafety(
      summary({
        payoutRatio: 0.4,
        fcfPayoutRatio: 0.4,
        netDebtToEbitda: 0.5,
        consecutiveGrowthYears: 12,
        lastCutYear: null,
      }),
    )
    expect(assessment.score).toBe(100)
    expect(assessment.band).toBe('strong')
    expect(assessment.factors).toHaveLength(5)
    expect(assessment.factors.every((factor) => factor.verdict === 'strong')).toBe(true)
    const cuts = assessment.factors.find((factor) => factor.factor === 'Past cuts')
    expect(cuts?.detail).toBe('No dividend cut on record.')
  })

  it('scores an adequate payer with every adequate verdict', () => {
    const assessment = dividendSafety(
      summary({
        payoutRatio: 0.6,
        fcfPayoutRatio: 0.7,
        netDebtToEbitda: 2,
        consecutiveGrowthYears: 5,
        lastCutYear: 2010,
      }),
    )
    expect(assessment.score).toBe(60)
    expect(assessment.band).toBe('adequate')
    expect(assessment.factors.every((factor) => factor.verdict === 'adequate')).toBe(true)
  })

  it('scores a weak payer with every weak verdict', () => {
    const assessment = dividendSafety(
      summary({
        payoutRatio: 0.9,
        fcfPayoutRatio: 0.9,
        netDebtToEbitda: 5,
        consecutiveGrowthYears: 1,
        lastCutYear: 2024,
      }),
    )
    expect(assessment.score).toBe(20)
    expect(assessment.band).toBe('weak')
    expect(assessment.factors.every((factor) => factor.verdict === 'weak')).toBe(true)
    const cuts = assessment.factors.find((factor) => factor.factor === 'Past cuts')
    expect(cuts?.detail).toBe('Last cut in 2024.')
  })
})

describe('dividendPortfolio', () => {
  it('aggregates income, sectors and contributors', () => {
    const result = dividendPortfolio([
      { ticker: 'MDCR', value: 10000 },
      { ticker: 'HLVT', value: 5000 },
      { ticker: 'CNVX', value: 4000 },
      { ticker: 'NBLA', value: 3000 },
      { ticker: 'ZZZ', value: 1000 },
    ])
    expect(result.unavailable).toEqual(['NBLA', 'ZZZ'])
    expect(result.annualIncome).toBeGreaterThan(0)
    expect(result.monthlyIncome).toBeCloseTo(result.annualIncome / 12, 1)
    expect(result.quarterlyIncome).toBeCloseTo(result.annualIncome / 4, 1)
    expect(result.weightedYieldPercent).toBeGreaterThan(0)
    const financials = result.bySector.find((sector) => sector.label === 'Financials')
    expect(financials).toBeDefined()
    expect(result.topContributors[0].ticker).toBe('MDCR')
    const totalPercent = result.topContributors.reduce((sum, item) => sum + item.percent, 0)
    expect(totalPercent).toBeCloseTo(100, 1)
  })

  it('handles zero income without dividing by zero', () => {
    const result = dividendPortfolio([{ ticker: 'MDCR', value: 0 }])
    expect(result.annualIncome).toBe(0)
    expect(result.weightedYieldPercent).toBe(0)
    expect(result.bySector[0].percent).toBe(0)
    expect(result.topContributors[0].percent).toBe(0)
  })

  it('reports every holding as unavailable when none pay', () => {
    const result = dividendPortfolio([{ ticker: 'NBLA', value: 1000 }])
    expect(result.unavailable).toEqual(['NBLA'])
    expect(result.annualIncome).toBe(0)
    expect(result.bySector).toEqual([])
    expect(result.topContributors).toEqual([])
  })
})

describe('simulateDrip', () => {
  it('computes hand-verified first-year figures with reinvestment', () => {
    const rows = simulateDrip({
      initialInvestment: 10000,
      annualContribution: 1000,
      startingYieldPercent: 4,
      dividendGrowth: 0.05,
      priceGrowth: 0.06,
      reinvest: true,
      years: 2,
    })
    expect(rows[0]).toEqual({
      year: 1,
      startingValue: 10000,
      contributions: 1000,
      dividendIncome: 400,
      reinvested: 400,
      endingValue: 12000,
      yieldOnCost: 4,
    })
    expect(rows[1].startingValue).toBe(12000)
    expect(rows).toHaveLength(2)
  })

  it('does not reinvest when disabled', () => {
    const rows = simulateDrip({
      initialInvestment: 10000,
      annualContribution: 1000,
      startingYieldPercent: 4,
      dividendGrowth: 0.05,
      priceGrowth: 0.06,
      reinvest: false,
      years: 1,
    })
    expect(rows[0].reinvested).toBe(0)
    expect(rows[0].endingValue).toBe(11600)
  })

  it('avoids dividing by zero when the cost basis is zero', () => {
    const rows = simulateDrip({
      initialInvestment: 0,
      annualContribution: 0,
      startingYieldPercent: 4,
      dividendGrowth: 0.05,
      priceGrowth: 0.06,
      reinvest: true,
      years: 1,
    })
    expect(rows[0].yieldOnCost).toBe(0)
    expect(rows[0].endingValue).toBe(0)
  })
})

describe('dripScenarios', () => {
  it('returns 5/10/20-year horizons', () => {
    const scenarios = dripScenarios({
      initialInvestment: 10000,
      annualContribution: 1000,
      startingYieldPercent: 4,
      dividendGrowth: 0.05,
      priceGrowth: 0.06,
      reinvest: true,
    })
    expect(scenarios.map((scenario) => scenario.horizon)).toEqual([5, 10, 20])
    expect(scenarios[0].finalValue).toBeGreaterThan(10000)
    expect(scenarios[2].finalValue).toBeGreaterThan(scenarios[0].finalValue)
    expect(scenarios[0].annualIncome).toBeGreaterThan(0)
  })
})
