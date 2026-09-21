import { AS_OF, getCompany } from './universe'

/**
 * Dividend research engine.
 *
 * Every figure is derived from the bundled sample dataset. When a company is
 * unknown or pays no dividend the engine returns `null` rather than inventing a
 * yield, and portfolio holdings without dividend data are surfaced explicitly.
 */

const REFERENCE_YEAR = Number(AS_OF.slice(0, 4))

/** Verdict weights used by {@link dividendSafety}; they sum to 1. */
const SAFETY_WEIGHTS = {
  earningsPayout: 0.25,
  fcfPayout: 0.25,
  balanceSheet: 0.2,
  growthStreak: 0.15,
  pastCuts: 0.15,
} as const

/** Points awarded per verdict, blended into the weighted safety score. */
const VERDICT_POINTS: Record<Verdict, number> = {
  strong: 100,
  adequate: 60,
  weak: 20,
}

export type Verdict = 'strong' | 'adequate' | 'weak'

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export interface DividendSummary {
  ticker: string
  yieldPercent: number
  annualDividend: number
  paymentsPerYear: number
  exDividendDate: string
  payoutRatio: number
  fcfPayoutRatio: number
  consecutiveGrowthYears: number
  cagr3y: number | null
  cagr5y: number | null
  cagr10y: number | null
  lastCutYear: number | null
  netDebtToEbitda: number
}

/**
 * Builds a dividend summary for a ticker, or `null` when the company is unknown
 * or does not pay a dividend.
 */
export function dividendSummary(ticker: string): DividendSummary | null {
  const company = getCompany(ticker)
  if (!company || !company.dividend) return null
  const { fundamentals, dividend, prices } = company
  const price = prices[prices.length - 1].close
  const ebitda = (fundamentals.marketCap + fundamentals.netDebt) / fundamentals.evToEbitda
  return {
    ticker: company.security.ticker,
    yieldPercent: round((dividend.annualDividend / price) * 100),
    annualDividend: dividend.annualDividend,
    paymentsPerYear: dividend.paymentsPerYear,
    exDividendDate: dividend.exDividendDate,
    payoutRatio: dividend.payoutRatio,
    fcfPayoutRatio: dividend.fcfPayoutRatio,
    consecutiveGrowthYears: dividend.consecutiveGrowthYears,
    cagr3y: dividend.cagr3y,
    cagr5y: dividend.cagr5y,
    cagr10y: dividend.cagr10y,
    lastCutYear: dividend.lastCutYear,
    netDebtToEbitda: round(fundamentals.netDebt / ebitda),
  }
}

export interface SafetyFactor {
  factor: string
  value: number
  verdict: Verdict
  weight: number
  detail: string
}

export interface SafetyAssessment {
  score: number
  band: Verdict
  factors: SafetyFactor[]
}

function classify(value: number, strongMax: number, adequateMax: number): Verdict {
  if (value <= strongMax) return 'strong'
  if (value <= adequateMax) return 'adequate'
  return 'weak'
}

function bandFor(score: number): Verdict {
  if (score >= 80) return 'strong'
  if (score >= 50) return 'adequate'
  return 'weak'
}

/**
 * Produces an explainable safety assessment: each contributing factor carries
 * its own value, verdict and weight, and the score is their weighted sum.
 */
export function dividendSafety(summary: DividendSummary): SafetyAssessment {
  const earningsVerdict = classify(summary.payoutRatio, 0.5, 0.75)
  const fcfVerdict = classify(summary.fcfPayoutRatio, 0.5, 0.8)
  const balanceVerdict = classify(summary.netDebtToEbitda, 1, 3)
  const streakVerdict: Verdict =
    summary.consecutiveGrowthYears >= 10
      ? 'strong'
      : summary.consecutiveGrowthYears >= 3
        ? 'adequate'
        : 'weak'
  const yearsSinceCut = summary.lastCutYear === null ? null : REFERENCE_YEAR - summary.lastCutYear
  const cutsVerdict: Verdict =
    yearsSinceCut === null ? 'strong' : yearsSinceCut >= 10 ? 'adequate' : 'weak'

  const factors: SafetyFactor[] = [
    {
      factor: 'Earnings payout',
      value: summary.payoutRatio,
      verdict: earningsVerdict,
      weight: SAFETY_WEIGHTS.earningsPayout,
      detail: `Dividend consumes ${round(summary.payoutRatio * 100)}% of earnings.`,
    },
    {
      factor: 'FCF payout',
      value: summary.fcfPayoutRatio,
      verdict: fcfVerdict,
      weight: SAFETY_WEIGHTS.fcfPayout,
      detail: `Dividend consumes ${round(summary.fcfPayoutRatio * 100)}% of free cash flow.`,
    },
    {
      factor: 'Balance sheet',
      value: summary.netDebtToEbitda,
      verdict: balanceVerdict,
      weight: SAFETY_WEIGHTS.balanceSheet,
      detail: `Net debt is ${summary.netDebtToEbitda}x EBITDA.`,
    },
    {
      factor: 'Growth streak',
      value: summary.consecutiveGrowthYears,
      verdict: streakVerdict,
      weight: SAFETY_WEIGHTS.growthStreak,
      detail: `${summary.consecutiveGrowthYears} consecutive years of increases.`,
    },
    {
      factor: 'Past cuts',
      value: yearsSinceCut === null ? REFERENCE_YEAR : yearsSinceCut,
      verdict: cutsVerdict,
      weight: SAFETY_WEIGHTS.pastCuts,
      detail:
        summary.lastCutYear === null
          ? 'No dividend cut on record.'
          : `Last cut in ${summary.lastCutYear}.`,
    },
  ]

  const score = round(
    factors.reduce((sum, factor) => sum + VERDICT_POINTS[factor.verdict] * factor.weight, 0),
  )
  return { score, band: bandFor(score), factors }
}

export interface DividendPortfolioInput {
  ticker: string
  value: number
}

export interface DividendPortfolioSummary {
  weightedYieldPercent: number
  annualIncome: number
  monthlyIncome: number
  quarterlyIncome: number
  bySector: { label: string; income: number; percent: number }[]
  topContributors: { ticker: string; income: number; percent: number }[]
  unavailable: string[]
}

/**
 * Aggregates dividend income across holdings. Tickers without dividend data are
 * returned in `unavailable` rather than silently assumed to yield zero.
 */
export function dividendPortfolio(inputs: DividendPortfolioInput[]): DividendPortfolioSummary {
  const unavailable: string[] = []
  let coveredValue = 0
  let annualIncome = 0
  const sectorIncome = new Map<string, number>()
  const contributors: { ticker: string; income: number }[] = []

  for (const input of inputs) {
    const company = getCompany(input.ticker)
    if (!company || !company.dividend) {
      unavailable.push(input.ticker)
      continue
    }
    const summary = dividendSummary(input.ticker) as DividendSummary
    const income = (input.value * summary.yieldPercent) / 100
    coveredValue += input.value
    annualIncome += income
    contributors.push({ ticker: summary.ticker, income })
    const sector = company.security.sector
    sectorIncome.set(sector, (sectorIncome.get(sector) ?? 0) + income)
  }

  const bySector = [...sectorIncome.entries()]
    .map(([label, income]) => ({
      label,
      income: round(income),
      percent: annualIncome > 0 ? round((income / annualIncome) * 100) : 0,
    }))
    .sort((a, b) => b.income - a.income)

  const topContributors = contributors
    .sort((a, b) => b.income - a.income)
    .slice(0, 5)
    .map((contributor) => ({
      ticker: contributor.ticker,
      income: round(contributor.income),
      percent: annualIncome > 0 ? round((contributor.income / annualIncome) * 100) : 0,
    }))

  return {
    weightedYieldPercent: coveredValue > 0 ? round((annualIncome / coveredValue) * 100) : 0,
    annualIncome: round(annualIncome),
    monthlyIncome: round(annualIncome / 12),
    quarterlyIncome: round(annualIncome / 4),
    bySector,
    topContributors,
    unavailable,
  }
}

export interface DripInput {
  initialInvestment: number
  annualContribution: number
  startingYieldPercent: number
  dividendGrowth: number
  priceGrowth: number
  reinvest: boolean
  years: number
}

export interface DripYear {
  year: number
  startingValue: number
  contributions: number
  dividendIncome: number
  reinvested: number
  endingValue: number
  yieldOnCost: number
}

/**
 * Simulates a dividend reinvestment plan year by year. Dividend yield compounds
 * at `dividendGrowth`, price at `priceGrowth`, and reinvestment is toggled by
 * `reinvest`; `yieldOnCost` measures income against cumulative cost basis.
 */
export function simulateDrip(input: DripInput): DripYear[] {
  const rows: DripYear[] = []
  let value = input.initialInvestment
  for (let year = 1; year <= input.years; year += 1) {
    const startingValue = value
    const yieldFraction = (input.startingYieldPercent / 100) * (1 + input.dividendGrowth) ** (year - 1)
    const dividendIncome = startingValue * yieldFraction
    const reinvested = input.reinvest ? dividendIncome : 0
    const priceAppreciation = startingValue * input.priceGrowth
    const contributions = input.annualContribution
    const endingValue = startingValue + priceAppreciation + reinvested + contributions
    const costBasis = input.initialInvestment + input.annualContribution * (year - 1)
    const yieldOnCost = costBasis > 0 ? round((dividendIncome / costBasis) * 100) : 0
    rows.push({
      year,
      startingValue: round(startingValue),
      contributions: round(contributions),
      dividendIncome: round(dividendIncome),
      reinvested: round(reinvested),
      endingValue: round(endingValue),
      yieldOnCost,
    })
    value = endingValue
  }
  return rows
}

/** Runs the DRIP simulation for the standard 5/10/20-year horizons. */
export function dripScenarios(
  input: Omit<DripInput, 'years'>,
): { horizon: number; finalValue: number; annualIncome: number }[] {
  return [5, 10, 20].map((horizon) => {
    const rows = simulateDrip({ ...input, years: horizon })
    const last = rows[rows.length - 1]
    return { horizon, finalValue: last.endingValue, annualIncome: last.dividendIncome }
  })
}
