import { describe, expect, it } from 'vitest'
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASS_STATS,
  BENCHMARKS,
  allocateContribution,
  benchmarkStatistics,
  compareToCurrent,
  portfolioStatistics,
  rebalancingRules,
  targetAllocation,
  taxConsiderations,
  type AllocationComparison,
  type AssetClass,
} from './builder'
import type { InvestorProfile } from './types'

function profile(overrides: Partial<InvestorProfile> = {}): InvestorProfile {
  return {
    investmentAmount: 100000,
    horizonYears: 10,
    riskTolerance: 'balanced',
    incomeNeedPercent: 0,
    liquidityReservePercent: 0,
    accountType: 'taxable',
    monthlyContribution: 0,
    ...overrides,
  }
}

function sum(slices: { targetPercent: number }[]): number {
  return slices.reduce((total, slice) => total + slice.targetPercent, 0)
}

const RISK_TOLERANCES: InvestorProfile['riskTolerance'][] = [
  'conservative',
  'balanced',
  'growth',
  'aggressive',
]

describe('targetAllocation', () => {
  it('always sums to exactly 100 across risk tolerances and the alternatives toggle', () => {
    for (const riskTolerance of RISK_TOLERANCES) {
      for (const includeAlternatives of [false, true]) {
        const allocation = targetAllocation(profile({ riskTolerance }), includeAlternatives)
        expect(sum(allocation)).toBe(100)
        for (const slice of allocation) {
          expect(ASSET_CLASS_LABELS[slice.assetClass]).toBeDefined()
          expect(slice.targetPercent).toBeGreaterThan(0)
        }
      }
    }
  })

  it('adds alternatives when requested', () => {
    const withAlts = targetAllocation(profile(), true)
    expect(withAlts.some((slice) => slice.assetClass === 'alternatives')).toBe(true)
  })

  it('tilts for short and long horizons and income needs', () => {
    const short = targetAllocation(profile({ horizonYears: 3 }))
    const long = targetAllocation(profile({ horizonYears: 20 }))
    const income = targetAllocation(profile({ incomeNeedPercent: 5 }))
    expect(sum(short)).toBe(100)
    expect(sum(long)).toBe(100)
    expect(sum(income)).toBe(100)
    const longEquity =
      long.find((slice) => slice.assetClass === 'domestic-equity')?.targetPercent ?? 0
    const shortEquity =
      short.find((slice) => slice.assetClass === 'domestic-equity')?.targetPercent ?? 0
    expect(longEquity).toBeGreaterThan(shortEquity)
  })

  it('respects a large liquidity reserve floor', () => {
    const allocation = targetAllocation(profile({ liquidityReservePercent: 30 }))
    const cash = allocation.find((slice) => slice.assetClass === 'cash')
    expect(cash?.targetPercent).toBeGreaterThanOrEqual(30)
    expect(sum(allocation)).toBe(100)
  })
})

describe('compareToCurrent', () => {
  const target = targetAllocation(profile())

  it('flags buy, sell and out-of-target holdings', () => {
    const current: { assetClass: AssetClass; value: number }[] = [
      { assetClass: 'domestic-equity', value: 90000 },
      { assetClass: 'alternatives', value: 10000 },
    ]
    const comparison = compareToCurrent(target, current)
    expect(comparison.find((row) => row.assetClass === 'domestic-equity')?.action).toBe('sell')
    expect(comparison.find((row) => row.assetClass === 'government-bonds')?.action).toBe('buy')
    expect(comparison.find((row) => row.assetClass === 'alternatives')?.targetPercent).toBe(0)
  })

  it('treats an empty current book and wide tolerance as holds', () => {
    const emptyCompare = compareToCurrent(target, [])
    expect(emptyCompare.every((row) => row.currentPercent === 0)).toBe(true)

    const holds = compareToCurrent(
      target,
      [{ assetClass: 'domestic-equity', value: 100000 }],
      100,
    )
    expect(holds.every((row) => row.action === 'hold')).toBe(true)
  })
})

describe('allocateContribution', () => {
  const target = targetAllocation(profile())

  const deficitComparison: AllocationComparison[] = [
    { assetClass: 'domestic-equity', targetPercent: 35, currentPercent: 30, driftPercent: -5, tradeValue: 600, action: 'buy' },
    { assetClass: 'government-bonds', targetPercent: 20, currentPercent: 16, driftPercent: -4, tradeValue: 400, action: 'buy' },
    { assetClass: 'cash', targetPercent: 5, currentPercent: 8, driftPercent: 3, tradeValue: -300, action: 'hold' },
  ]

  it('returns nothing for a non-positive contribution', () => {
    expect(allocateContribution(target, deficitComparison, 0)).toEqual([])
  })

  it('splits proportionally when the contribution is below the total deficit', () => {
    const result = allocateContribution(target, deficitComparison, 500)
    const total = result.reduce((acc, entry) => acc + entry.amount, 0)
    expect(total).toBeCloseTo(500, 1)
    expect(result.every((entry) => entry.amount > 0)).toBe(true)
  })

  it('fills deficits then spreads the surplus by target weight', () => {
    const result = allocateContribution(target, deficitComparison, 2000)
    const total = result.reduce((acc, entry) => acc + entry.amount, 0)
    expect(total).toBeCloseTo(2000, 0)
    expect(result.some((entry) => entry.assetClass === 'cash')).toBe(true)
  })

  it('spreads entirely by target weight when there is no deficit', () => {
    const balanced: AllocationComparison[] = [
      { assetClass: 'domestic-equity', targetPercent: 35, currentPercent: 40, driftPercent: 5, tradeValue: -100, action: 'sell' },
    ]
    const result = allocateContribution(target, balanced, 1000)
    const total = result.reduce((acc, entry) => acc + entry.amount, 0)
    expect(total).toBeCloseTo(1000, 0)
  })
})

describe('portfolioStatistics', () => {
  it('produces weighted return, volatility and yield', () => {
    const stats = portfolioStatistics(targetAllocation(profile()))
    expect(stats.expectedReturn).toBeGreaterThan(0)
    expect(stats.volatility).toBeGreaterThan(0)
    expect(stats.incomeYield).toBeGreaterThan(0)
  })
})

describe('rebalancingRules', () => {
  it('tailors rules for a cautious, contributing, short-horizon investor', () => {
    const rules = rebalancingRules(
      profile({ riskTolerance: 'conservative', monthlyContribution: 500, horizonYears: 3 }),
    )
    expect(rules.some((rule) => rule.includes('3-5%'))).toBe(true)
    expect(rules.some((rule) => rule.includes('contributions'))).toBe(true)
    expect(rules.some((rule) => rule.includes('short horizon'))).toBe(true)
  })

  it('uses a wider band for aggressive long-horizon investors', () => {
    const rules = rebalancingRules(
      profile({ riskTolerance: 'aggressive', monthlyContribution: 0, horizonYears: 20 }),
    )
    expect(rules.some((rule) => rule.includes('5-10%'))).toBe(true)
    expect(rules.some((rule) => rule.includes('contributions'))).toBe(false)
  })
})

describe('taxConsiderations', () => {
  it('always leads with a non-advice disclaimer', () => {
    for (const accountType of ['taxable', 'tax-deferred', 'tax-free'] as const) {
      const notes = taxConsiderations(profile({ accountType }))
      expect(notes[0].toLowerCase()).toContain('not personalised tax advice')
    }
  })

  it('adds account-specific and income-specific notes', () => {
    const taxable = taxConsiderations(profile({ accountType: 'taxable', incomeNeedPercent: 5 }))
    expect(taxable.some((note) => note.includes('long-term rates'))).toBe(true)
    expect(taxable.some((note) => note.includes('tax drag'))).toBe(true)
    expect(taxConsiderations(profile({ accountType: 'tax-deferred' })).some((note) =>
      note.includes('defer taxes'),
    )).toBe(true)
    expect(taxConsiderations(profile({ accountType: 'tax-free' })).some((note) =>
      note.includes('without tax'),
    )).toBe(true)
  })
})

describe('benchmarks', () => {
  it('exposes a 60/40 and all-equity blend', () => {
    expect(BENCHMARKS.map((benchmark) => benchmark.id)).toEqual(
      expect.arrayContaining(['balanced-60-40', 'all-equity']),
    )
    expect(ASSET_CLASS_STATS['domestic-equity'].expectedReturn).toBeGreaterThan(0)
  })

  it('computes statistics for known benchmarks and null for unknown', () => {
    const sixtyForty = benchmarkStatistics('balanced-60-40')
    expect(sixtyForty?.expectedReturn).toBeGreaterThan(0)
    expect(sixtyForty?.volatility).toBeGreaterThan(0)
    expect(benchmarkStatistics('does-not-exist')).toBeNull()
  })
})
