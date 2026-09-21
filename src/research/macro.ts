import { createRandom, hashString } from './random'
import { AS_OF, DATA_PROVIDER, RETRIEVED_AT } from './universe'
import { roundTo } from '../lib/numbers'
import type { MacroEvent, MacroPoint, MacroSeries } from './types'

/**
 * Macro intelligence.
 *
 * Observed economic data (the series below) is kept strictly separate from
 * scenario analysis: scenarios are explicitly labelled estimates and never
 * merged into the historical record.
 */

const MONTHS = 36

interface MacroSeed {
  id: string
  label: string
  unit: string
  category: MacroSeries['category']
  start: number
  end: number
  noise: number
  decimals: number
}

const SEEDS: MacroSeed[] = [
  { id: 'policy-rate', label: 'Policy rate', unit: '%', category: 'rates', start: 5.25, end: 3.75, noise: 0.03, decimals: 2 },
  { id: 'yield-2y', label: '2-year government yield', unit: '%', category: 'rates', start: 4.8, end: 3.45, noise: 0.08, decimals: 2 },
  { id: 'yield-10y', label: '10-year government yield', unit: '%', category: 'rates', start: 4.2, end: 4.05, noise: 0.09, decimals: 2 },
  { id: 'cpi', label: 'Headline CPI (yoy)', unit: '%', category: 'inflation', start: 3.7, end: 2.4, noise: 0.06, decimals: 2 },
  { id: 'core-cpi', label: 'Core CPI (yoy)', unit: '%', category: 'inflation', start: 4.1, end: 2.8, noise: 0.05, decimals: 2 },
  { id: 'gdp', label: 'Real GDP growth (yoy)', unit: '%', category: 'growth', start: 2.6, end: 1.8, noise: 0.1, decimals: 2 },
  { id: 'unemployment', label: 'Unemployment rate', unit: '%', category: 'labour', start: 3.8, end: 4.4, noise: 0.04, decimals: 2 },
  { id: 'payrolls', label: 'Non-farm payrolls', unit: 'thousand', category: 'labour', start: 210, end: 135, noise: 22, decimals: 0 },
  { id: 'consumer-spending', label: 'Real consumer spending (yoy)', unit: '%', category: 'growth', start: 2.9, end: 2.1, noise: 0.12, decimals: 2 },
  { id: 'pmi-manufacturing', label: 'Manufacturing PMI', unit: 'index', category: 'growth', start: 47.5, end: 51.2, noise: 0.6, decimals: 1 },
  { id: 'pmi-services', label: 'Services PMI', unit: 'index', category: 'growth', start: 53.1, end: 52.4, noise: 0.7, decimals: 1 },
  { id: 'credit-spreads', label: 'High-yield credit spread', unit: 'bps', category: 'credit', start: 410, end: 318, noise: 14, decimals: 0 },
  { id: 'dollar-index', label: 'Trade-weighted dollar index', unit: 'index', category: 'fx', start: 104.2, end: 99.6, noise: 0.9, decimals: 2 },
  { id: 'oil', label: 'Brent crude', unit: 'USD/bbl', category: 'commodity', start: 84, end: 71, noise: 2.4, decimals: 2 },
  { id: 'equity-index', label: 'Sample broad market index', unit: 'index', category: 'equity', start: 4380, end: 5210, noise: 55, decimals: 2 },
]

function monthlyDates(count: number, end = AS_OF): string[] {
  const cursor = new Date(`${end.slice(0, 7)}-01T00:00:00.000Z`)
  const dates: string[] = []
  for (let index = 0; index < count; index += 1) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCMonth(cursor.getUTCMonth() - 1)
  }
  return dates.reverse()
}

function buildSeries(seed: MacroSeed): MacroSeries {
  const random = createRandom(hashString(seed.id))
  const dates = monthlyDates(MONTHS)
  const points: MacroPoint[] = dates.map((date, index) => {
    const progress = index / (MONTHS - 1)
    const trend = seed.start + (seed.end - seed.start) * progress
    const value = index === MONTHS - 1 ? seed.end : trend + (random() - 0.5) * 2 * seed.noise
    return { date, value: roundTo(value, seed.decimals) }
  })
  return {
    id: seed.id,
    label: seed.label,
    unit: seed.unit,
    category: seed.category,
    points,
    provenance: {
      provider: DATA_PROVIDER,
      source: 'bundled-macro-v1',
      asOf: dates[dates.length - 1],
      retrievedAt: RETRIEVED_AT,
      currency: 'USD',
    },
  }
}

export const MACRO_SERIES: MacroSeries[] = SEEDS.map(buildSeries)

export function getSeries(id: string): MacroSeries | undefined {
  return MACRO_SERIES.find((series) => series.id === id)
}

export function latestValue(series: MacroSeries): number {
  return series.points[series.points.length - 1].value
}

/** Change over `months`, or `null` when the history is too short. */
export function changeOver(series: MacroSeries, months: number): number | null {
  const points = series.points
  const index = points.length - 1 - months
  if (index < 0) return null
  return roundTo(points[points.length - 1].value - points[index].value, 2)
}

/** 10-year minus 2-year spread; negative values mean an inverted curve. */
export function yieldCurveSpread(longId = 'yield-10y', shortId = 'yield-2y'): number | null {
  const long = getSeries(longId)
  const short = getSeries(shortId)
  if (!long || !short) return null
  return roundTo(latestValue(long) - latestValue(short), 2)
}

export const MACRO_CALENDAR: MacroEvent[] = [
  { date: '2026-09-24', label: 'Central bank rate decision', importance: 'high' },
  { date: '2026-10-02', label: 'Non-farm payrolls', importance: 'high' },
  { date: '2026-10-13', label: 'CPI release', importance: 'high' },
  { date: '2026-10-20', label: 'Retail sales', importance: 'medium' },
  { date: '2026-10-29', label: 'Advance GDP estimate', importance: 'high' },
  { date: '2026-11-04', label: 'Manufacturing PMI', importance: 'low' },
]

export type MacroFactor =
  | 'policy-rates'
  | 'inflation'
  | 'growth'
  | 'dollar'
  | 'energy'
  | 'credit'

export interface FactorExposure {
  factor: MacroFactor
  label: string
  mechanism: string
  /** -3 (hurt by a rise in the factor) to +3 (helped by a rise). */
  sensitivity: number
}

/**
 * Sector sensitivities to each macro factor. These are transparent heuristics
 * from the sample factor sheet, not regression betas from live market data.
 */
export const SECTOR_FACTOR_SENSITIVITY: Record<MacroFactor, Record<string, number>> = {
  'policy-rates': {
    Financials: 1,
    Utilities: -2,
    'Real Estate': -3,
    'Information Technology': -2,
    'Consumer Discretionary': -2,
    'Communication Services': -1,
    'Consumer Staples': -1,
    Industrials: -1,
    'Health Care': 0,
    Energy: 0,
    Materials: -1,
  },
  inflation: {
    Energy: 2,
    Materials: 2,
    'Real Estate': 1,
    'Consumer Staples': -1,
    'Consumer Discretionary': -2,
    'Information Technology': -1,
    Financials: 0,
    Utilities: -1,
    Industrials: -1,
    'Health Care': 0,
    'Communication Services': -1,
  },
  growth: {
    'Consumer Discretionary': 3,
    Industrials: 2,
    'Information Technology': 2,
    Materials: 2,
    Financials: 1,
    Energy: 1,
    'Communication Services': 1,
    'Real Estate': 0,
    'Health Care': 0,
    'Consumer Staples': -1,
    Utilities: -1,
  },
  dollar: {
    'Information Technology': -1,
    Materials: -2,
    Energy: -2,
    Industrials: -1,
    'Consumer Staples': -1,
    'Health Care': 0,
    Financials: 0,
    Utilities: 1,
    'Real Estate': 1,
    'Consumer Discretionary': 0,
    'Communication Services': 0,
  },
  energy: {
    Energy: 3,
    Materials: 1,
    Industrials: -1,
    'Consumer Discretionary': -2,
    'Consumer Staples': -1,
    Utilities: -1,
    'Information Technology': -1,
    Financials: 0,
    'Health Care': 0,
    'Real Estate': 0,
    'Communication Services': 0,
  },
  credit: {
    Financials: -2,
    'Real Estate': -2,
    Utilities: -1,
    Industrials: -1,
    'Consumer Discretionary': -1,
    'Information Technology': -1,
    Energy: -1,
    Materials: -1,
    'Health Care': 0,
    'Consumer Staples': 0,
    'Communication Services': -1,
  },
}

export const FACTOR_LABELS: Record<MacroFactor, string> = {
  'policy-rates': 'Policy rates',
  inflation: 'Inflation',
  growth: 'Economic growth',
  dollar: 'US dollar',
  energy: 'Energy prices',
  credit: 'Credit conditions',
}

const FACTOR_MECHANISM: Record<MacroFactor, string> = {
  'policy-rates': 'Discount rate on long-duration cash flows and cost of leverage.',
  inflation: 'Input costs, pricing power and real consumer income.',
  growth: 'Volume demand and operating leverage.',
  dollar: 'Translation of overseas revenue and competitiveness of exports.',
  energy: 'Fuel, freight and feedstock costs versus realised commodity prices.',
  credit: 'Refinancing cost and availability for leveraged balance sheets.',
}

export interface ExposureHolding {
  ticker: string
  sector: string
  /** Portfolio weight in percent. */
  weight: number
}

export interface ExposureRow {
  factor: MacroFactor
  label: string
  mechanism: string
  sensitivity: number
  holdings: { ticker: string; sensitivity: number; weight: number }[]
}

export function exposureMap(holdings: ExposureHolding[]): ExposureRow[] {
  return (Object.keys(FACTOR_LABELS) as MacroFactor[]).map((factor) => {
    const table = SECTOR_FACTOR_SENSITIVITY[factor]
    const mapped = holdings.map((holding) => ({
      ticker: holding.ticker,
      weight: holding.weight,
      sensitivity: table[holding.sector] ?? 0,
    }))
    const totalWeight = mapped.reduce((sum, holding) => sum + holding.weight, 0)
    const sensitivity =
      totalWeight === 0
        ? 0
        : roundTo(
            mapped.reduce((sum, holding) => sum + holding.sensitivity * holding.weight, 0) / totalWeight,
            2,
          )
    return {
      factor,
      label: FACTOR_LABELS[factor],
      mechanism: FACTOR_MECHANISM[factor],
      sensitivity,
      holdings: mapped.sort((a, b) => a.sensitivity - b.sensitivity),
    }
  })
}

export interface MacroScenario {
  id: string
  label: string
  description: string
  /** Factor shocks in standardised units (roughly one notch per unit). */
  shocks: Partial<Record<MacroFactor, number>>
}

export const MACRO_SCENARIOS: MacroScenario[] = [
  {
    id: 'higher-for-longer',
    label: 'Higher-for-longer rates',
    description: 'Policy rates stay restrictive for four more quarters.',
    shocks: { 'policy-rates': 1.5, growth: -0.5, credit: 0.5 },
  },
  {
    id: 'rate-cut-cycle',
    label: 'Rate-cut cycle',
    description: 'A sustained easing cycle begins within two quarters.',
    shocks: { 'policy-rates': -1.5, growth: 0.5 },
  },
  {
    id: 'inflation-resurgence',
    label: 'Inflation resurgence',
    description: 'Core inflation reaccelerates above 4%.',
    shocks: { inflation: 2, 'policy-rates': 1, growth: -0.5 },
  },
  {
    id: 'recession',
    label: 'Recession',
    description: 'Two consecutive quarters of contracting output.',
    shocks: { growth: -2.5, credit: 1.5, 'policy-rates': -1 },
  },
  {
    id: 'soft-landing',
    label: 'Soft landing',
    description: 'Inflation normalises while growth stays positive.',
    shocks: { growth: 1, inflation: -1, 'policy-rates': -0.5 },
  },
  {
    id: 'dollar-strength',
    label: 'Dollar strengthening',
    description: 'A 10% trade-weighted appreciation of the dollar.',
    shocks: { dollar: 2 },
  },
  {
    id: 'commodity-shock',
    label: 'Commodity shock',
    description: 'Energy prices rise 40% on a supply disruption.',
    shocks: { energy: 2, inflation: 1.5, growth: -1 },
  },
]

export interface ScenarioEstimate {
  scenarioId: string
  label: string
  description: string
  /** Estimated portfolio impact in percent — an estimate, not a forecast. */
  estimatedImpactPercent: number
  holdings: { ticker: string; estimatedImpactPercent: number }[]
  disclaimer: string
}

const DISCLAIMER =
  'Scenario output is an estimate derived from transparent sector sensitivities. It is not a forecast or a guaranteed outcome.'

export function scenarioImpact(
  holdings: ExposureHolding[],
  scenarioId: string,
): ScenarioEstimate | null {
  const scenario = MACRO_SCENARIOS.find((candidate) => candidate.id === scenarioId)
  if (!scenario) return null
  const entries = holdings.map((holding) => {
    let impact = 0
    for (const [factor, shock] of Object.entries(scenario.shocks) as [MacroFactor, number][]) {
      const sensitivity = SECTOR_FACTOR_SENSITIVITY[factor][holding.sector] ?? 0
      impact += sensitivity * shock * 1.5
    }
    return { ticker: holding.ticker, estimatedImpactPercent: roundTo(impact, 2), weight: holding.weight }
  })
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  const portfolioImpact =
    totalWeight === 0
      ? 0
      : roundTo(
          entries.reduce((sum, entry) => sum + entry.estimatedImpactPercent * entry.weight, 0) / totalWeight,
          2,
        )
  return {
    scenarioId: scenario.id,
    label: scenario.label,
    description: scenario.description,
    estimatedImpactPercent: portfolioImpact,
    holdings: entries.map(({ ticker, estimatedImpactPercent }) => ({ ticker, estimatedImpactPercent })),
    disclaimer: DISCLAIMER,
  }
}
