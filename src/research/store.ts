import { readJSON, writeJSON } from '../lib/storage'
import type { InvestorProfile, Portfolio, ResearchReport, ResearchWatchlist } from './types'
import type { AlertRule } from './researchAlerts'
import type { SavedScreen } from './screener'

/** Per-user research state kept in localStorage alongside the watch alerts. */

export const RESEARCH_KEYS = {
  portfolios: 'pw.research.portfolios',
  watchlists: 'pw.research.watchlists',
  reports: 'pw.research.reports',
  screens: 'pw.research.screens',
  rules: 'pw.research.alertRules',
  profile: 'pw.research.profile',
} as const

export const DEFAULT_PROFILE: InvestorProfile = {
  investmentAmount: 250_000,
  horizonYears: 15,
  riskTolerance: 'balanced',
  incomeNeedPercent: 2,
  liquidityReservePercent: 5,
  accountType: 'taxable',
  monthlyContribution: 1_500,
}

export function defaultPortfolio(): Portfolio {
  return {
    id: 'core',
    name: 'Core portfolio',
    cash: 25_000,
    benchmark: 'balanced-60-40',
    positions: [
      { ticker: 'ARCL', quantity: 320 },
      { ticker: 'NBLA', quantity: 140 },
      { ticker: 'MDCR', quantity: 260 },
      { ticker: 'AQFL', quantity: 400 },
      { ticker: 'VLGR', quantity: 180 },
    ],
    transactions: [],
  }
}

/** Resolves the selected portfolio, falling back to the first one when the id is stale. */
export function selectPortfolio(portfolios: Portfolio[], id: string): Portfolio {
  return portfolios.find((entry) => entry.id === id) ?? portfolios[0]
}

export function defaultWatchlists(): ResearchWatchlist[] {
  return [
    { id: 'ideas', name: 'Research ideas', tickers: ['CNVX', 'KNSU', 'ZPHR'] },
    { id: 'income', name: 'Income candidates', tickers: ['AQFL', 'ORBP', 'TERA'] },
  ]
}

function loadArray<T>(key: string, fallback: T[]): T[] {
  const stored = readJSON<T[]>(key, fallback)
  return Array.isArray(stored) ? stored : fallback
}

export function loadPortfolios(): Portfolio[] {
  return loadArray(RESEARCH_KEYS.portfolios, [defaultPortfolio()])
}

export function savePortfolios(portfolios: Portfolio[]): void {
  writeJSON(RESEARCH_KEYS.portfolios, portfolios)
}

export function loadWatchlists(): ResearchWatchlist[] {
  return loadArray(RESEARCH_KEYS.watchlists, defaultWatchlists())
}

export function saveWatchlists(watchlists: ResearchWatchlist[]): void {
  writeJSON(RESEARCH_KEYS.watchlists, watchlists)
}

export function loadReports(): ResearchReport[] {
  return loadArray<ResearchReport>(RESEARCH_KEYS.reports, [])
}

export function saveReports(reports: ResearchReport[]): void {
  writeJSON(RESEARCH_KEYS.reports, reports)
}

export function loadScreens(): SavedScreen[] {
  return loadArray<SavedScreen>(RESEARCH_KEYS.screens, [])
}

export function saveScreens(screens: SavedScreen[]): void {
  writeJSON(RESEARCH_KEYS.screens, screens)
}

export function loadRules(fallback: AlertRule[]): AlertRule[] {
  return loadArray(RESEARCH_KEYS.rules, fallback)
}

export function saveRules(rules: AlertRule[]): void {
  writeJSON(RESEARCH_KEYS.rules, rules)
}

export function loadProfile(): InvestorProfile {
  return readJSON<InvestorProfile>(RESEARCH_KEYS.profile, DEFAULT_PROFILE)
}

export function saveProfile(profile: InvestorProfile): void {
  writeJSON(RESEARCH_KEYS.profile, profile)
}
