/**
 * Deterministic portfolio risk engine.
 *
 * Every function is pure and derives its numbers from the bundled sample
 * universe. Outputs are estimates based on sample data and historical
 * relationships — never guarantees of future results.
 */

import { roundTo } from '../lib/numbers'
import { dailyReturns, getCompany, standardDeviation } from './universe'

export interface HoldingInput {
  ticker: string
  quantity: number
}

export interface Holding {
  ticker: string
  quantity: number
  price: number
  value: number
  weight: number
  sector: string
  country: string
  currency: string
  beta: number
}

const TRADING_DAYS_PER_YEAR = 252
const CASH_TICKER = 'CASH'

/** Trading days assumed available to liquidate against a fraction of volume. */
const LIQUIDITY_LOOKBACK = 20

/**
 * Duration-like rate sensitivity score (in notional years) per sector. Rate
 * sensitive, long-duration cash-flow sectors such as Utilities and Real Estate
 * score highest; short-duration sectors such as Energy score lowest. Values are
 * heuristic sample assumptions, not measured durations.
 */
export const SECTOR_RATE_SENSITIVITY: Record<string, number> = {
  Utilities: 8,
  'Real Estate': 7.5,
  'Consumer Staples': 5,
  'Communication Services': 4,
  'Health Care': 4,
  Industrials: 3.5,
  'Information Technology': 3,
  'Consumer Discretionary': 3,
  Materials: 2.5,
  Financials: 2,
  Energy: 1.5,
  Cash: 0,
}

const DEFAULT_RATE_SENSITIVITY = 3

/** Rate sensitivity score for a sector, falling back for unknown sectors. */
export function sectorRateSensitivity(sector: string): number {
  return SECTOR_RATE_SENSITIVITY[sector] ?? DEFAULT_RATE_SENSITIVITY
}

/**
 * Resolves each input to a priced holding using the sample universe. Unknown
 * tickers are skipped. When `cash` is supplied it is modelled as its own
 * holding so that weights reflect the full portfolio.
 */
export function buildHoldings(inputs: HoldingInput[], cash?: number): Holding[] {
  const priced: Omit<Holding, 'weight'>[] = []
  for (const input of inputs) {
    const company = getCompany(input.ticker)
    if (!company) continue
    const price = company.prices[company.prices.length - 1].close
    priced.push({
      ticker: company.security.ticker,
      quantity: input.quantity,
      price,
      value: input.quantity * price,
      sector: company.security.sector,
      country: company.security.country,
      currency: company.security.currency,
      beta: company.fundamentals.beta,
    })
  }
  if (cash !== undefined && cash > 0) {
    priced.push({
      ticker: CASH_TICKER,
      quantity: cash,
      price: 1,
      value: cash,
      sector: 'Cash',
      country: 'United States',
      currency: 'USD',
      beta: 0,
    })
  }
  const total = priced.reduce((sum, holding) => sum + holding.value, 0)
  return priced.map((holding) => ({
    ...holding,
    weight: total > 0 ? holding.value / total : 0,
  }))
}

export interface ExposureSlice {
  label: string
  value: number
  percent: number
}

/** Groups holdings by an attribute and returns exposures sorted descending. */
export function exposureBy(
  holdings: Holding[],
  key: 'sector' | 'country' | 'currency' | 'ticker',
): ExposureSlice[] {
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0)
  const groups = new Map<string, number>()
  for (const holding of holdings) {
    const label = holding[key]
    groups.set(label, (groups.get(label) ?? 0) + holding.value)
  }
  return [...groups.entries()]
    .map(([label, value]) => ({
      label,
      value: roundTo(value, 2),
      percent: total > 0 ? roundTo((value / total) * 100, 2) : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

export interface Concentration {
  topPositionPercent: number
  topFivePercent: number
  herfindahl: number
}

/** Concentration statistics from position weights (Herfindahl on fractions). */
export function concentration(holdings: Holding[]): Concentration {
  if (holdings.length === 0) {
    return { topPositionPercent: 0, topFivePercent: 0, herfindahl: 0 }
  }
  const weights = holdings.map((holding) => holding.weight).sort((a, b) => b - a)
  const topFive = weights.slice(0, 5).reduce((sum, weight) => sum + weight, 0)
  const herfindahl = weights.reduce((sum, weight) => sum + weight * weight, 0)
  return {
    topPositionPercent: roundTo(weights[0] * 100, 2),
    topFivePercent: roundTo(topFive * 100, 2),
    herfindahl: roundTo(herfindahl, 4),
  }
}

/** Pearson correlation of two equal-length (aligned) return series. */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i += 1) {
    sumA += a[i]
    sumB += b[i]
  }
  const meanA = sumA / n
  const meanB = sumB / n
  let cov = 0
  let varA = 0
  let varB = 0
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    cov += da * db
    varA += da * da
    varB += db * db
  }
  const denom = Math.sqrt(varA * varB)
  if (denom === 0) return 0
  return cov / denom
}

export interface CorrelationMatrix {
  tickers: string[]
  matrix: number[][]
}

/** Correlation matrix of daily returns for the supplied tickers. */
export function correlationMatrix(tickers: string[]): CorrelationMatrix {
  const returns = tickers.map((ticker) => {
    const company = getCompany(ticker)
    return company ? dailyReturns(company.prices.map((point) => point.close)) : []
  })
  const matrix = returns.map((series, i) =>
    returns.map((other, j) => (i === j ? 1 : roundTo(correlation(series, other), 4))),
  )
  return { tickers, matrix }
}

/** Annualised volatility (fraction) from a daily return series. */
export function annualisedVolatility(returns: number[]): number {
  return standardDeviation(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR)
}

/** Historical VaR as a positive loss fraction at the given confidence level. */
export function historicalVar(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0
  const sorted = [...returns].sort((a, b) => a - b)
  const cutoff = Math.max(1, Math.floor((1 - confidence) * sorted.length))
  const quantile = sorted[cutoff - 1]
  return quantile < 0 ? -quantile : 0
}

/** Expected shortfall (average tail loss) as a positive loss fraction. */
export function expectedShortfall(returns: number[], confidence = 0.95): number {
  if (returns.length === 0) return 0
  const sorted = [...returns].sort((a, b) => a - b)
  const cutoff = Math.max(1, Math.floor((1 - confidence) * sorted.length))
  const tail = sorted.slice(0, cutoff)
  const mean = tail.reduce((sum, value) => sum + value, 0) / tail.length
  return mean < 0 ? -mean : 0
}

/** Maximum drawdown (positive fraction) of the cumulative return path. */
export function maxDrawdown(returns: number[]): number {
  let cumulative = 1
  let peak = 1
  let drawdown = 0
  for (const value of returns) {
    cumulative *= 1 + value
    if (cumulative > peak) peak = cumulative
    const current = (peak - cumulative) / peak
    if (current > drawdown) drawdown = current
  }
  return drawdown
}

export interface RiskMetrics {
  annualVolatility: number
  beta: number
  maxDrawdown: number
  valueAtRisk95: number
  expectedShortfall95: number
  sharpeLike: number
  liquidityDays: number | null
  rateSensitivity: number
}

/** Weighted daily portfolio return series built from sample price history. */
function portfolioReturnSeries(holdings: Holding[]): number[] {
  const series = holdings.map((holding) => {
    const company = getCompany(holding.ticker)
    return {
      weight: holding.weight,
      returns: company ? dailyReturns(company.prices.map((point) => point.close)) : [],
    }
  })
  const length = series.reduce((max, entry) => Math.max(max, entry.returns.length), 0)
  const combined: number[] = []
  for (let day = 0; day < length; day += 1) {
    let value = 0
    for (const entry of series) {
      value += entry.weight * (entry.returns[day] ?? 0)
    }
    combined.push(value)
  }
  return combined
}

/** Average daily dollar volume for a holding, or null when volume is absent. */
function averageDollarVolume(holding: Holding): number | null {
  const company = getCompany(holding.ticker)
  if (!company) return null
  const recent = company.prices.slice(-LIQUIDITY_LOOKBACK)
  const avgVolume = recent.reduce((sum, point) => sum + point.volume, 0) / recent.length
  return avgVolume * holding.price
}

/** Aggregate risk metrics for a portfolio of holdings. */
export function riskMetrics(holdings: Holding[]): RiskMetrics {
  const returns = portfolioReturnSeries(holdings)
  const volatility = annualisedVolatility(returns)
  const mean =
    returns.length > 0 ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0
  const annualReturn = mean * TRADING_DAYS_PER_YEAR
  const beta = holdings.reduce((sum, holding) => sum + holding.weight * holding.beta, 0)
  const rateSensitivity = holdings.reduce(
    (sum, holding) => sum + holding.weight * sectorRateSensitivity(holding.sector),
    0,
  )

  let liquidityValue = 0
  let liquidityVolume = 0
  let hasVolume = false
  for (const holding of holdings) {
    const dollarVolume = averageDollarVolume(holding)
    if (dollarVolume === null) continue
    hasVolume = true
    liquidityValue += holding.value
    liquidityVolume += dollarVolume
  }
  const liquidityDays =
    hasVolume && liquidityVolume > 0 ? roundTo(liquidityValue / liquidityVolume, 2) : null

  return {
    annualVolatility: roundTo(volatility * 100, 2),
    beta: roundTo(beta, 3),
    maxDrawdown: roundTo(maxDrawdown(returns) * 100, 2),
    valueAtRisk95: roundTo(historicalVar(returns, 0.95) * 100, 2),
    expectedShortfall95: roundTo(expectedShortfall(returns, 0.95) * 100, 2),
    sharpeLike: volatility > 0 ? roundTo(annualReturn / volatility, 3) : 0,
    liquidityDays,
    rateSensitivity: roundTo(rateSensitivity, 2),
  }
}

export interface StressScenario {
  id: string
  label: string
  description: string
  /** Estimated percentage change applied to a single holding. */
  shockPercent: (holding: Holding) => number
}

const CYCLICAL_SECTORS = new Set([
  'Consumer Discretionary',
  'Financials',
  'Industrials',
  'Materials',
])

const TECH_SECTORS = new Set(['Information Technology', 'Communication Services'])

function isCash(holding: Holding): boolean {
  return holding.ticker === CASH_TICKER
}

/**
 * Stress scenarios apply sector, beta and currency aware shocks. All numbers
 * are estimated illustrative moves, not predictions of actual outcomes.
 */
export const STRESS_SCENARIOS: StressScenario[] = [
  {
    id: 'equity-decline',
    label: 'Equity market decline (-20%)',
    description: 'Estimated broad equity sell-off scaled by each holding beta.',
    shockPercent: (holding) => (isCash(holding) ? 0 : -20 * holding.beta),
  },
  {
    id: 'recession',
    label: 'Recession',
    description: 'Estimated downturn hitting cyclical sectors harder than defensives.',
    shockPercent: (holding) => {
      if (isCash(holding)) return 0
      if (CYCLICAL_SECTORS.has(holding.sector)) return -25
      if (holding.sector === 'Consumer Staples' || holding.sector === 'Utilities') return -8
      return -15
    },
  },
  {
    id: 'rate-increase',
    label: 'Interest rate increase (+100bps)',
    description: 'Estimated impact of higher rates on rate-sensitive sectors.',
    shockPercent: (holding) =>
      isCash(holding) ? 0 : -1.2 * sectorRateSensitivity(holding.sector),
  },
  {
    id: 'rate-decrease',
    label: 'Interest rate decrease (-100bps)',
    description: 'Estimated tailwind from lower rates for long-duration sectors.',
    shockPercent: (holding) =>
      isCash(holding) ? 0 : 0.9 * sectorRateSensitivity(holding.sector),
  },
  {
    id: 'usd-appreciation',
    label: 'USD appreciation (+10%)',
    description: 'Estimated drag on non-USD assets when the dollar strengthens.',
    shockPercent: (holding) =>
      isCash(holding) || holding.currency === 'USD' ? 0 : -10,
  },
  {
    id: 'usd-depreciation',
    label: 'USD depreciation (-10%)',
    description: 'Estimated boost to non-USD assets when the dollar weakens.',
    shockPercent: (holding) =>
      isCash(holding) || holding.currency === 'USD' ? 0 : 10,
  },
  {
    id: 'tech-selloff',
    label: 'Technology sell-off',
    description: 'Estimated rotation out of technology and communication names.',
    shockPercent: (holding) => {
      if (isCash(holding)) return 0
      return TECH_SECTORS.has(holding.sector) ? -30 : -5
    },
  },
  {
    id: 'inflation-shock',
    label: 'Inflation shock',
    description: 'Estimated move favouring real assets over rate-sensitive growth.',
    shockPercent: (holding) => {
      if (isCash(holding)) return 0
      if (holding.sector === 'Energy' || holding.sector === 'Materials') return 8
      if (holding.sector === 'Consumer Discretionary') return -12
      return -6
    },
  },
]

export interface StressResult {
  id: string
  label: string
  description: string
  portfolioImpactPercent: number
  portfolioImpactValue: number
  worstHoldings: { ticker: string; impactPercent: number }[]
}

/** Applies every stress scenario to the portfolio and ranks worst holdings. */
export function runStressTests(holdings: Holding[]): StressResult[] {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0)
  return STRESS_SCENARIOS.map((scenario) => {
    const perHolding = holdings.map((holding) => ({
      ticker: holding.ticker,
      impactPercent: roundTo(scenario.shockPercent(holding), 2),
      weight: holding.weight,
    }))
    const impactPercent = perHolding.reduce(
      (sum, entry) => sum + entry.weight * entry.impactPercent,
      0,
    )
    const worstHoldings = [...perHolding]
      .sort((a, b) => a.impactPercent - b.impactPercent)
      .slice(0, 3)
      .map((entry) => ({ ticker: entry.ticker, impactPercent: entry.impactPercent }))
    return {
      id: scenario.id,
      label: scenario.label,
      description: scenario.description,
      portfolioImpactPercent: roundTo(impactPercent, 2),
      portfolioImpactValue: roundTo((impactPercent / 100) * totalValue, 2),
      worstHoldings,
    }
  })
}

export interface RiskHeatMapRow {
  risk: string
  exposure: string
  severity: 'low' | 'medium' | 'high'
  contributors: string[]
  mitigation: string
}

function severityFrom(value: number, mediumAt: number, highAt: number): 'low' | 'medium' | 'high' {
  if (value >= highAt) return 'high'
  if (value >= mediumAt) return 'medium'
  return 'low'
}

/** Human-readable heat map of the main portfolio risks. */
export function riskHeatMap(holdings: Holding[], metrics: RiskMetrics): RiskHeatMapRow[] {
  const conc = concentration(holdings)
  const sectors = exposureBy(holdings, 'sector')
  const currencies = exposureBy(holdings, 'currency')
  const tickers = exposureBy(holdings, 'ticker')

  const topSectorPercent = sectors.length > 0 ? sectors[0].percent : 0
  const foreignPercent = currencies
    .filter((slice) => slice.label !== 'USD')
    .reduce((sum, slice) => sum + slice.percent, 0)

  const liquidityValue = metrics.liquidityDays ?? Number.POSITIVE_INFINITY
  const liquiditySeverity: 'low' | 'medium' | 'high' =
    metrics.liquidityDays === null ? 'medium' : severityFrom(liquidityValue, 2, 5)

  return [
    {
      risk: 'Position concentration',
      exposure: `Top position is an estimated ${conc.topPositionPercent}% of the portfolio.`,
      severity: severityFrom(conc.topPositionPercent, 15, 25),
      contributors: tickers.slice(0, 3).map((slice) => slice.label),
      mitigation: 'Trim outsized positions; the estimated impact of a single-name shock scales with weight.',
    },
    {
      risk: 'Sector concentration',
      exposure: `Largest sector is an estimated ${topSectorPercent}% of exposure.`,
      severity: severityFrom(topSectorPercent, 25, 40),
      contributors: sectors.slice(0, 3).map((slice) => slice.label),
      mitigation: 'Diversify across sectors to reduce estimated correlated drawdowns.',
    },
    {
      risk: 'Geographic and currency exposure',
      exposure: `Non-USD currency exposure is an estimated ${roundTo(foreignPercent, 2)}%.`,
      severity: severityFrom(foreignPercent, 20, 40),
      contributors: currencies.slice(0, 3).map((slice) => slice.label),
      mitigation: 'Consider currency hedging; FX moves have an estimated, not guaranteed, effect on returns.',
    },
    {
      risk: 'Volatility and drawdown',
      exposure: `Estimated annual volatility ${metrics.annualVolatility}% with ${metrics.maxDrawdown}% historical drawdown.`,
      severity: severityFrom(metrics.annualVolatility, 15, 25),
      contributors: tickers.slice(0, 3).map((slice) => slice.label),
      mitigation: 'Add lower-volatility or defensive assets to reduce the estimated swing.',
    },
    {
      risk: 'Interest rate sensitivity',
      exposure: `Estimated duration-like score of ${metrics.rateSensitivity}.`,
      severity: severityFrom(metrics.rateSensitivity, 4, 6),
      contributors: sectors.slice(0, 3).map((slice) => slice.label),
      mitigation: 'Balance rate-sensitive sectors; rate scenarios are estimated illustrations only.',
    },
    {
      risk: 'Liquidity',
      exposure:
        metrics.liquidityDays === null
          ? 'Volume data unavailable, so liquidity days cannot be estimated.'
          : `Estimated ${metrics.liquidityDays} days to unwind against sample volume.`,
      severity: liquiditySeverity,
      contributors: tickers.slice(0, 3).map((slice) => slice.label),
      mitigation: 'Favour liquid names; unwind time is an estimate based on sample volume.',
    },
  ]
}
