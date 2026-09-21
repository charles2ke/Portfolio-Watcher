/**
 * Deterministic portfolio construction engine.
 *
 * Turns an investor profile into a target allocation and supporting analytics.
 * Return, volatility and yield figures are long-run sample assumptions used for
 * illustration only — they are estimates, not forecasts or advice.
 */

import { roundTo } from '../lib/numbers'
import type { InvestorProfile } from './types'

export type AssetClass =
  | 'domestic-equity'
  | 'international-equity'
  | 'government-bonds'
  | 'corporate-bonds'
  | 'cash'
  | 'reits'
  | 'commodities'
  | 'alternatives'

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  'domestic-equity': 'Domestic equity',
  'international-equity': 'International equity',
  'government-bonds': 'Government bonds',
  'corporate-bonds': 'Corporate bonds',
  cash: 'Cash and equivalents',
  reits: 'Real estate (REITs)',
  commodities: 'Commodities',
  alternatives: 'Alternatives',
}

/**
 * Long-run sample assumptions per asset class (annualised fractions). These are
 * illustrative planning inputs, not forecasts of future returns.
 */
export const ASSET_CLASS_STATS: Record<
  AssetClass,
  { expectedReturn: number; volatility: number; yield: number }
> = {
  'domestic-equity': { expectedReturn: 0.08, volatility: 0.16, yield: 0.015 },
  'international-equity': { expectedReturn: 0.085, volatility: 0.18, yield: 0.025 },
  'government-bonds': { expectedReturn: 0.03, volatility: 0.05, yield: 0.03 },
  'corporate-bonds': { expectedReturn: 0.045, volatility: 0.07, yield: 0.04 },
  cash: { expectedReturn: 0.02, volatility: 0.005, yield: 0.02 },
  reits: { expectedReturn: 0.07, volatility: 0.19, yield: 0.04 },
  commodities: { expectedReturn: 0.04, volatility: 0.17, yield: 0 },
  alternatives: { expectedReturn: 0.06, volatility: 0.1, yield: 0.01 },
}

const ASSET_CLASS_ROLE: Record<AssetClass, 'core' | 'satellite'> = {
  'domestic-equity': 'core',
  'international-equity': 'core',
  'government-bonds': 'core',
  'corporate-bonds': 'core',
  cash: 'core',
  reits: 'satellite',
  commodities: 'satellite',
  alternatives: 'satellite',
}

const ASSET_CLASS_ETF: Record<AssetClass, string> = {
  'domestic-equity': 'VTI',
  'international-equity': 'VXUS',
  'government-bonds': 'GOVT',
  'corporate-bonds': 'LQD',
  cash: 'BIL',
  reits: 'VNQ',
  commodities: 'DBC',
  alternatives: 'QAI',
}

const ASSET_CLASS_ORDER: AssetClass[] = [
  'domestic-equity',
  'international-equity',
  'government-bonds',
  'corporate-bonds',
  'cash',
  'reits',
  'commodities',
  'alternatives',
]

export interface AllocationSlice {
  assetClass: AssetClass
  targetPercent: number
  role: 'core' | 'satellite'
  exampleEtf: string
}

type WeightMap = Record<AssetClass, number>

const BASE_WEIGHTS: Record<InvestorProfile['riskTolerance'], WeightMap> = {
  conservative: {
    'domestic-equity': 25,
    'international-equity': 10,
    'government-bonds': 30,
    'corporate-bonds': 20,
    cash: 10,
    reits: 3,
    commodities: 2,
    alternatives: 0,
  },
  balanced: {
    'domestic-equity': 35,
    'international-equity': 15,
    'government-bonds': 20,
    'corporate-bonds': 15,
    cash: 5,
    reits: 6,
    commodities: 4,
    alternatives: 0,
  },
  growth: {
    'domestic-equity': 45,
    'international-equity': 22,
    'government-bonds': 10,
    'corporate-bonds': 8,
    cash: 3,
    reits: 7,
    commodities: 5,
    alternatives: 0,
  },
  aggressive: {
    'domestic-equity': 55,
    'international-equity': 28,
    'government-bonds': 3,
    'corporate-bonds': 2,
    cash: 2,
    reits: 6,
    commodities: 4,
    alternatives: 0,
  },
}

/** Rounds float weights (summing to 100) to integers that still sum to 100. */
function roundWeights(weights: WeightMap): WeightMap {
  const floors = {} as WeightMap
  const fractions: { assetClass: AssetClass; fraction: number }[] = []
  let used = 0
  for (const assetClass of ASSET_CLASS_ORDER) {
    const value = weights[assetClass]
    const floor = Math.floor(value)
    floors[assetClass] = floor
    used += floor
    fractions.push({ assetClass, fraction: value - floor })
  }
  let remainder = Math.round(100 - used)
  fractions.sort((a, b) => b.fraction - a.fraction)
  for (const entry of fractions) {
    if (remainder <= 0) break
    floors[entry.assetClass] += 1
    remainder -= 1
  }
  return floors
}

/**
 * Deterministic target allocation from an investor profile. Risk tolerance sets
 * the base mix; horizon, income need and the liquidity reserve then tilt it.
 * The returned target percentages always sum to exactly 100.
 */
export function targetAllocation(
  profile: InvestorProfile,
  includeAlternatives = false,
): AllocationSlice[] {
  const raw: WeightMap = { ...BASE_WEIGHTS[profile.riskTolerance] }

  if (includeAlternatives) {
    raw.alternatives += 8
    raw['domestic-equity'] = Math.max(0, raw['domestic-equity'] - 5)
    raw['international-equity'] = Math.max(0, raw['international-equity'] - 3)
  }

  if (profile.horizonYears < 5) {
    raw['domestic-equity'] = Math.max(0, raw['domestic-equity'] - 10)
    raw['government-bonds'] += 7
    raw.cash += 3
  } else if (profile.horizonYears > 15) {
    raw['domestic-equity'] += 6
    raw['international-equity'] += 4
    raw['government-bonds'] = Math.max(0, raw['government-bonds'] - 10)
  }

  if (profile.incomeNeedPercent > 3) {
    raw['corporate-bonds'] += 5
    raw.reits += 3
    raw['domestic-equity'] = Math.max(0, raw['domestic-equity'] - 8)
  }

  const total = ASSET_CLASS_ORDER.reduce((sum, assetClass) => sum + raw[assetClass], 0)
  const scaled = {} as WeightMap
  for (const assetClass of ASSET_CLASS_ORDER) {
    scaled[assetClass] = (raw[assetClass] / total) * 100
  }

  const cashFloor = Math.min(100, Math.max(0, profile.liquidityReservePercent))
  if (scaled.cash < cashFloor) {
    const remaining = 100 - cashFloor
    const others = ASSET_CLASS_ORDER.filter((assetClass) => assetClass !== 'cash')
    const othersTotal = others.reduce((sum, assetClass) => sum + scaled[assetClass], 0)
    for (const assetClass of others) {
      scaled[assetClass] = (scaled[assetClass] / othersTotal) * remaining
    }
    scaled.cash = cashFloor
  }

  const rounded = roundWeights(scaled)

  return ASSET_CLASS_ORDER.filter((assetClass) => rounded[assetClass] > 0).map((assetClass) => ({
    assetClass,
    targetPercent: rounded[assetClass],
    role: ASSET_CLASS_ROLE[assetClass],
    exampleEtf: ASSET_CLASS_ETF[assetClass],
  }))
}

export interface AllocationComparison {
  assetClass: AssetClass
  targetPercent: number
  currentPercent: number
  driftPercent: number
  tradeValue: number
  action: 'buy' | 'sell' | 'hold'
}

/** Compares a target allocation to a current one and flags rebalancing trades. */
export function compareToCurrent(
  target: AllocationSlice[],
  current: { assetClass: AssetClass; value: number }[],
  tolerancePercent = 5,
): AllocationComparison[] {
  const totalValue = current.reduce((sum, entry) => sum + entry.value, 0)
  const targetMap = new Map(target.map((slice) => [slice.assetClass, slice.targetPercent]))
  const currentMap = new Map(current.map((entry) => [entry.assetClass, entry.value]))

  const assetClasses = ASSET_CLASS_ORDER.filter(
    (assetClass) => targetMap.has(assetClass) || currentMap.has(assetClass),
  )

  return assetClasses.map((assetClass) => {
    const targetPercent = targetMap.get(assetClass) ?? 0
    const value = currentMap.get(assetClass) ?? 0
    const currentPercent = totalValue > 0 ? (value / totalValue) * 100 : 0
    const driftPercent = currentPercent - targetPercent
    const tradeValue = ((targetPercent - currentPercent) / 100) * totalValue
    let action: 'buy' | 'sell' | 'hold' = 'hold'
    if (Math.abs(driftPercent) > tolerancePercent) {
      action = driftPercent > 0 ? 'sell' : 'buy'
    }
    return {
      assetClass,
      targetPercent: roundTo(targetPercent, 2),
      currentPercent: roundTo(currentPercent, 2),
      driftPercent: roundTo(driftPercent, 2),
      tradeValue: roundTo(tradeValue, 2),
      action,
    }
  })
}

/**
 * Splits a new contribution across the most underweight asset classes first,
 * then distributes any surplus by target weight.
 */
export function allocateContribution(
  target: AllocationSlice[],
  comparison: AllocationComparison[],
  contribution: number,
): { assetClass: AssetClass; amount: number }[] {
  if (contribution <= 0) return []

  const deficits = comparison
    .filter((entry) => entry.tradeValue > 0)
    .map((entry) => ({ assetClass: entry.assetClass, amount: entry.tradeValue }))
  const totalDeficit = deficits.reduce((sum, entry) => sum + entry.amount, 0)

  const allocations = new Map<AssetClass, number>()

  if (totalDeficit >= contribution && totalDeficit > 0) {
    for (const entry of deficits) {
      allocations.set(entry.assetClass, (entry.amount / totalDeficit) * contribution)
    }
  } else {
    for (const entry of deficits) {
      allocations.set(entry.assetClass, entry.amount)
    }
    const surplus = contribution - totalDeficit
    const targetTotal = target.reduce((sum, slice) => sum + slice.targetPercent, 0)
    for (const slice of target) {
      const share = (slice.targetPercent / targetTotal) * surplus
      allocations.set(slice.assetClass, (allocations.get(slice.assetClass) ?? 0) + share)
    }
  }

  const result: { assetClass: AssetClass; amount: number }[] = []
  for (const assetClass of ASSET_CLASS_ORDER) {
    const amount = allocations.get(assetClass) ?? 0
    if (amount > 0) result.push({ assetClass, amount: roundTo(amount, 2) })
  }
  return result
}

/** Weighted expected return, volatility and yield of a target allocation. */
export function portfolioStatistics(target: AllocationSlice[]): {
  expectedReturn: number
  volatility: number
  incomeYield: number
} {
  let expectedReturn = 0
  let volatility = 0
  let incomeYield = 0
  for (const slice of target) {
    const stats = ASSET_CLASS_STATS[slice.assetClass]
    const weight = slice.targetPercent / 100
    expectedReturn += weight * stats.expectedReturn
    volatility += weight * stats.volatility
    incomeYield += weight * stats.yield
  }
  return {
    expectedReturn: roundTo(expectedReturn * 100, 2),
    volatility: roundTo(volatility * 100, 2),
    incomeYield: roundTo(incomeYield * 100, 2),
  }
}

/** Rebalancing guidance tailored to the investor profile. */
export function rebalancingRules(profile: InvestorProfile): string[] {
  const rules: string[] = [
    'Review the allocation at least annually and rebalance when any class drifts beyond its tolerance band.',
  ]
  if (profile.riskTolerance === 'conservative' || profile.riskTolerance === 'balanced') {
    rules.push('Use a tighter 3-5% drift band to keep risk close to target.')
  } else {
    rules.push('A wider 5-10% drift band reduces trading while allowing winners to run.')
  }
  if (profile.monthlyContribution > 0) {
    rules.push('Direct new monthly contributions to underweight classes before selling anything.')
  }
  if (profile.horizonYears < 5) {
    rules.push('With a short horizon, prioritise topping up bonds and cash on rebalancing.')
  }
  return rules
}

/**
 * General educational tax context. These notes are not personalised tax advice;
 * consult a qualified professional for your own situation.
 */
export function taxConsiderations(profile: InvestorProfile): string[] {
  const notes: string[] = [
    'This is general educational information, not personalised tax advice.',
  ]
  if (profile.accountType === 'taxable') {
    notes.push('In a taxable account, holding assets over a year may qualify gains for long-term rates.')
    notes.push('Consider placing income-heavy assets like bonds and REITs in tax-advantaged accounts.')
  } else if (profile.accountType === 'tax-deferred') {
    notes.push('Tax-deferred accounts defer taxes until withdrawal, which may be taxed as ordinary income.')
  } else {
    notes.push('Tax-free accounts generally let qualified withdrawals grow and be taken without tax.')
  }
  if (profile.incomeNeedPercent > 3) {
    notes.push('High income needs can raise the tax drag of interest and dividends in taxable accounts.')
  }
  return notes
}

export const BENCHMARKS: { id: string; label: string; blend: Partial<Record<AssetClass, number>> }[] = [
  {
    id: 'balanced-60-40',
    label: 'Classic 60/40',
    blend: {
      'domestic-equity': 40,
      'international-equity': 20,
      'government-bonds': 25,
      'corporate-bonds': 15,
    },
  },
  {
    id: 'all-equity',
    label: 'All equity',
    blend: {
      'domestic-equity': 70,
      'international-equity': 30,
    },
  },
]

/** Expected return and volatility of a named benchmark, or null if unknown. */
export function benchmarkStatistics(
  id: string,
): { expectedReturn: number; volatility: number } | null {
  const benchmark = BENCHMARKS.find((entry) => entry.id === id)
  if (!benchmark) return null
  let expectedReturn = 0
  let volatility = 0
  for (const [assetClass, percent] of Object.entries(benchmark.blend) as [AssetClass, number][]) {
    const stats = ASSET_CLASS_STATS[assetClass]
    const weight = percent / 100
    expectedReturn += weight * stats.expectedReturn
    volatility += weight * stats.volatility
  }
  return {
    expectedReturn: roundTo(expectedReturn * 100, 2),
    volatility: roundTo(volatility * 100, 2),
  }
}
