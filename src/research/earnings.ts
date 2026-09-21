import { getCompany } from './universe'
import { roundTo } from '../lib/numbers'
import type { CompanyKpi, EarningsQuarter, GuidanceItem } from './types'

/** Earnings intelligence: surprise history, KPIs, guidance and scenarios. */

export interface QuarterAnalysis extends EarningsQuarter {
  epsSurprisePercent: number
  revenueSurprisePercent: number
}

export function analyseQuarter(quarter: EarningsQuarter): QuarterAnalysis {
  return {
    ...quarter,
    epsSurprisePercent:
      quarter.epsConsensus === 0
        ? 0
        : roundTo(((quarter.epsReported - quarter.epsConsensus) / Math.abs(quarter.epsConsensus)) * 100),
    revenueSurprisePercent:
      quarter.revenueConsensus === 0
        ? 0
        : roundTo(
            ((quarter.revenueReported - quarter.revenueConsensus) / Math.abs(quarter.revenueConsensus)) * 100,
          ),
  }
}

export interface GuidanceComparison extends GuidanceItem {
  midpoint: number
  /** `null` when no consensus is available; never assumed to be in line. */
  versusConsensusPercent: number | null
  verdict: 'above' | 'in-line' | 'below' | 'unknown'
}

export function compareGuidance(item: GuidanceItem): GuidanceComparison {
  const midpoint = roundTo((item.low + item.high) / 2, 4)
  if (item.consensus === null || item.consensus === 0) {
    return { ...item, midpoint, versusConsensusPercent: null, verdict: 'unknown' }
  }
  const versus = roundTo(((midpoint - item.consensus) / Math.abs(item.consensus)) * 100)
  const verdict = versus > 1 ? 'above' : versus < -1 ? 'below' : 'in-line'
  return { ...item, midpoint, versusConsensusPercent: versus, verdict }
}

export interface EarningsScenario {
  name: 'bull' | 'base' | 'bear'
  epsEstimate: number
  revenueEstimate: number
  priceReactionPercent: number
  rationale: string
}

export interface EarningsAnalysis {
  ticker: string
  nextEarningsDate: string
  quarters: QuarterAnalysis[]
  averageEpsSurprisePercent: number
  beatRatePercent: number
  averageAbsoluteReactionPercent: number
  kpis: CompanyKpi[]
  guidance: GuidanceComparison[]
  /** `null` when no reliable options data is available for the security. */
  impliedMovePercent: number | null
  scenarios: EarningsScenario[]
}

/** Market-implied move from the at-the-money straddle, when options exist. */
export function impliedMove(ticker: string): number | null {
  const company = getCompany(ticker)
  if (!company?.options) return null
  const { atmCall, atmPut, underlyingPrice } = company.options
  return roundTo(((atmCall + atmPut) / underlyingPrice) * 100)
}

export function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export interface QuarterSummary {
  averageEpsSurprisePercent: number
  beatRatePercent: number
  averageAbsoluteReactionPercent: number
}

export function summariseQuarters(quarters: QuarterAnalysis[]): QuarterSummary {
  const beats = quarters.filter((quarter) => quarter.epsSurprisePercent > 0).length
  return {
    averageEpsSurprisePercent: roundTo(average(quarters.map((quarter) => quarter.epsSurprisePercent))),
    beatRatePercent: quarters.length === 0 ? 0 : roundTo((beats / quarters.length) * 100),
    averageAbsoluteReactionPercent: roundTo(
      average(quarters.map((quarter) => Math.abs(quarter.priceReactionPercent))),
    ),
  }
}

export function analyseEarnings(ticker: string): EarningsAnalysis | null {
  const company = getCompany(ticker)
  if (!company) return null
  const quarters = company.earnings.map(analyseQuarter)
  const summary = summariseQuarters(quarters)
  const move = impliedMove(ticker)
  const expectedMove = move ?? summary.averageAbsoluteReactionPercent
  const lastQuarter = quarters[quarters.length - 1]
  const growth = company.fundamentals.epsGrowth
  const base = roundTo(lastQuarter.epsReported * (1 + growth / 4), 2)
  const revenueBase = roundTo(lastQuarter.revenueReported * (1 + company.fundamentals.revenueGrowth / 4), 1)
  return {
    ticker: company.security.ticker,
    nextEarningsDate: company.nextEarningsDate,
    quarters,
    ...summary,
    kpis: company.kpis,
    guidance: company.guidance.map(compareGuidance),
    impliedMovePercent: move,
    scenarios: [
      {
        name: 'bull',
        epsEstimate: roundTo(base * 1.06, 2),
        revenueEstimate: roundTo(revenueBase * 1.03, 1),
        priceReactionPercent: roundTo(expectedMove),
        rationale: 'Beat and raise in line with the strongest surprise in the reported history.',
      },
      {
        name: 'base',
        epsEstimate: base,
        revenueEstimate: revenueBase,
        priceReactionPercent: 0,
        rationale: 'Results land inside guidance and consensus; reaction depends on positioning.',
      },
      {
        name: 'bear',
        epsEstimate: roundTo(base * 0.94, 2),
        revenueEstimate: roundTo(revenueBase * 0.97, 1),
        priceReactionPercent: roundTo(-expectedMove),
        rationale: 'Miss or softer guidance, sized on the options-implied or historical move.',
      },
    ],
  }
}

/** Companies reporting within the given window, ordered by date. */
export function upcomingEarnings(
  tickers: string[],
): { ticker: string; name: string; date: string }[] {
  return tickers
    .map((ticker) => getCompany(ticker))
    .filter((company): company is NonNullable<typeof company> => company !== undefined)
    .map((company) => ({
      ticker: company.security.ticker,
      name: company.security.name,
      date: company.nextEarningsDate,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker))
}
