/**
 * Core entities for the research platform.
 *
 * Every time-sensitive financial record carries provenance (provider, source,
 * as-of, retrieved-at, currency) so the UI can always tell the user where a
 * number came from and how fresh it is.
 */

export interface Provenance {
  provider: string
  source: string
  /** Effective date of the underlying data point (ISO-8601). */
  asOf: string
  /** When the application ingested the record (ISO-8601). */
  retrievedAt: string
  currency: string
}

/** A value that may legitimately be unavailable. `null` means "not available". */
export interface Sourced<T> {
  value: T | null
  provenance: Provenance
}

export interface Security {
  ticker: string
  name: string
  exchange: string
  currency: string
  sector: string
  industry: string
  country: string
}

export interface Fundamentals {
  marketCap: number
  revenue: number
  revenueGrowth: number
  epsGrowth: number
  eps: number
  peRatio: number
  forwardPe: number
  pegRatio: number
  evToEbitda: number
  priceToFcf: number
  roic: number
  roe: number
  grossMargin: number
  operatingMargin: number
  netMargin: number
  debtToEquity: number
  freeCashFlow: number
  dividendYield: number
  payoutRatio: number
  momentum12m: number
  volatility: number
  beta: number
  dilutedShares: number
  netDebt: number
  taxRate: number
  depreciation: number
  capex: number
  workingCapitalChange: number
  researchAndDevelopment: number
}

export interface PricePoint {
  date: string
  close: number
  high: number
  low: number
  volume: number
}

export interface EarningsQuarter {
  period: string
  reportDate: string
  epsReported: number
  epsConsensus: number
  revenueReported: number
  revenueConsensus: number
  priceReactionPercent: number
}

export interface CompanyKpi {
  label: string
  value: number
  unit: string
  period: string
}

export interface GuidanceItem {
  metric: string
  low: number
  high: number
  consensus: number | null
  unit: string
}

export interface DividendProfile {
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
}

export interface OwnershipRecord {
  institutionalPercent: number
  insiderPercent: number
  shortInterestPercent: number
}

export interface InsiderTransaction {
  date: string
  person: string
  type: 'buy' | 'sell'
  shares: number
  value: number
}

export interface OptionSnapshot {
  expiry: string
  underlyingPrice: number
  atmCall: number
  atmPut: number
}

export interface MarketSharePoint {
  year: number
  sharePercent: number
}

export interface MoatDimension {
  dimension: string
  score: number
  evidence: string
}

export interface CompanyRecord {
  security: Security
  fundamentals: Fundamentals
  prices: PricePoint[]
  nextEarningsDate: string
  earnings: EarningsQuarter[]
  kpis: CompanyKpi[]
  guidance: GuidanceItem[]
  dividend: DividendProfile | null
  ownership: OwnershipRecord
  insiders: InsiderTransaction[]
  options: OptionSnapshot | null
  peers: string[]
  /** `null` when no reliable market-share data exists for the company. */
  marketShare: MarketSharePoint[] | null
  moat: MoatDimension[]
  innovation: string[]
  capitalAllocation: string[]
  threats: string[]
  catalysts: string[]
  risks: string[]
  provenance: Provenance
}

export interface MacroPoint {
  date: string
  value: number
}

export type MacroCategory =
  | 'rates'
  | 'inflation'
  | 'growth'
  | 'labour'
  | 'credit'
  | 'fx'
  | 'commodity'
  | 'equity'

export interface MacroSeries {
  id: string
  label: string
  unit: string
  category: MacroCategory
  points: MacroPoint[]
  provenance: Provenance
}

export interface MacroEvent {
  date: string
  label: string
  importance: 'high' | 'medium' | 'low'
}

export interface Position {
  ticker: string
  quantity: number
}

export interface Transaction {
  id: string
  date: string
  ticker: string
  type: 'buy' | 'sell' | 'dividend'
  quantity: number
  price: number
}

export interface Portfolio {
  id: string
  name: string
  cash: number
  benchmark: string
  positions: Position[]
  transactions: Transaction[]
}

export interface ResearchWatchlist {
  id: string
  name: string
  tickers: string[]
}

export type ResearchAlertType =
  | 'price'
  | 'earnings'
  | 'valuation'
  | 'dividend'
  | 'technical'
  | 'concentration'
  | 'macro'

export interface ResearchAlert {
  id: string
  type: ResearchAlertType
  subject: string
  message: string
  severity: 'info' | 'warning' | 'critical'
}

export interface ResearchReport {
  id: string
  title: string
  module: string
  ticker: string | null
  createdAt: string
  /** Frozen inputs so a stored report never changes when live data changes. */
  assumptions: Record<string, number | string | null>
  /** Frozen calculated outputs at generation time. */
  snapshot: Record<string, number | string | null>
  sources: Provenance[]
  modelVersion: string
  calculationVersion: string
}

export interface InvestorProfile {
  investmentAmount: number
  horizonYears: number
  riskTolerance: 'conservative' | 'balanced' | 'growth' | 'aggressive'
  incomeNeedPercent: number
  liquidityReservePercent: number
  accountType: 'taxable' | 'tax-deferred' | 'tax-free'
  monthlyContribution: number
}
