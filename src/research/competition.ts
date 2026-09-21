import { UNIVERSE, getCompany } from './universe'
import { roundTo } from '../lib/numbers'
import type { CompanyRecord, MarketSharePoint, MoatDimension } from './types'

/** Competitive landscape: peer sets, comparison tables and moat analysis. */

export interface PeerMetricRow {
  metric: string
  unit: 'currency-millions' | 'percent' | 'ratio'
  values: { ticker: string; value: number | null }[]
}

export function peerSet(
  ticker: string,
  maxPeers = 3,
  universe: CompanyRecord[] = UNIVERSE,
): CompanyRecord[] {
  const company = getCompany(ticker)
  if (!company) return []
  const explicit = company.peers
    .map((peer) => getCompany(peer))
    .filter((peer): peer is CompanyRecord => peer !== undefined)
  if (explicit.length >= maxPeers) return explicit.slice(0, maxPeers)
  const sameSector = universe.filter(
    (candidate) =>
      candidate.security.ticker !== company.security.ticker &&
      candidate.security.sector === company.security.sector &&
      !explicit.some((peer) => peer.security.ticker === candidate.security.ticker),
  )
  return [...explicit, ...sameSector].slice(0, maxPeers)
}

/** Every peer in an industry, used when the user screens by industry. */
export function industryPeers(industry: string): CompanyRecord[] {
  return UNIVERSE.filter((company) => company.security.industry === industry)
}

const ROWS: {
  metric: string
  unit: PeerMetricRow['unit']
  read: (company: CompanyRecord) => number
}[] = [
  { metric: 'Market cap', unit: 'currency-millions', read: (c) => c.fundamentals.marketCap },
  { metric: 'Revenue', unit: 'currency-millions', read: (c) => c.fundamentals.revenue },
  { metric: 'Revenue growth', unit: 'percent', read: (c) => c.fundamentals.revenueGrowth * 100 },
  { metric: 'Gross margin', unit: 'percent', read: (c) => c.fundamentals.grossMargin * 100 },
  { metric: 'Operating margin', unit: 'percent', read: (c) => c.fundamentals.operatingMargin * 100 },
  {
    metric: 'FCF margin',
    unit: 'percent',
    read: (c) => (c.fundamentals.freeCashFlow / c.fundamentals.revenue) * 100,
  },
  { metric: 'ROIC', unit: 'percent', read: (c) => c.fundamentals.roic * 100 },
  {
    metric: 'R&D intensity',
    unit: 'percent',
    read: (c) => (c.fundamentals.researchAndDevelopment / c.fundamentals.revenue) * 100,
  },
  { metric: 'EV/EBITDA', unit: 'ratio', read: (c) => c.fundamentals.evToEbitda },
  { metric: 'Forward P/E', unit: 'ratio', read: (c) => c.fundamentals.forwardPe },
]

export function comparisonTable(companies: CompanyRecord[]): PeerMetricRow[] {
  return ROWS.map((row) => ({
    metric: row.metric,
    unit: row.unit,
    values: companies.map((company) => ({
      ticker: company.security.ticker,
      value: roundTo(row.read(company)),
    })),
  }))
}

export interface MoatComparison {
  dimension: string
  values: { ticker: string; score: number | null }[]
}

export function moatComparison(companies: CompanyRecord[]): MoatComparison[] {
  const dimensions = companies[0]?.moat.map((entry: MoatDimension) => entry.dimension) ?? []
  return dimensions.map((dimension) => ({
    dimension,
    values: companies.map((company) => ({
      ticker: company.security.ticker,
      score: company.moat.find((entry) => entry.dimension === dimension)?.score ?? null,
    })),
  }))
}

export interface MarketShareSeries {
  ticker: string
  /** `null` when the dataset has no reliable market-share history. */
  points: MarketSharePoint[] | null
}

export function marketShareTrends(companies: CompanyRecord[]): MarketShareSeries[] {
  return companies.map((company) => ({
    ticker: company.security.ticker,
    points: company.marketShare,
  }))
}

export interface QualitativeSection {
  title: string
  items: string[]
  /** False when the dataset carries no sourced commentary for this company. */
  available: boolean
}

export function qualitativeSections(company: CompanyRecord): QualitativeSection[] {
  const sections: [string, string[]][] = [
    ['Innovation pipeline', company.innovation],
    ['Capital allocation', company.capitalAllocation],
    ['Industry threats', company.threats],
    ['Potential catalysts', company.catalysts],
    ['Company-specific risks', company.risks],
  ]
  return sections.map(([title, items]) => ({ title, items, available: items.length > 0 }))
}

export interface CompetitiveLandscape {
  company: CompanyRecord
  peers: CompanyRecord[]
  table: PeerMetricRow[]
  moat: MoatComparison[]
  marketShare: MarketShareSeries[]
  qualitative: QualitativeSection[]
}

export function competitiveLandscape(ticker: string): CompetitiveLandscape | null {
  const company = getCompany(ticker)
  if (!company) return null
  const peers = peerSet(ticker)
  const group = [company, ...peers]
  return {
    company,
    peers,
    table: comparisonTable(group),
    moat: moatComparison(group),
    marketShare: marketShareTrends(group),
    qualitative: qualitativeSections(company),
  }
}
