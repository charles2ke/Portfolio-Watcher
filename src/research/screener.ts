import { UNIVERSE } from './universe'
import type { CompanyRecord, Fundamentals } from './types'

/**
 * Institutional stock screener.
 *
 * Every screening value comes from the structured financial records in the
 * dataset — no metric is estimated or generated at screen time.
 */

export type MetricKey =
  | 'marketCap'
  | 'revenueGrowth'
  | 'epsGrowth'
  | 'peRatio'
  | 'forwardPe'
  | 'pegRatio'
  | 'evToEbitda'
  | 'priceToFcf'
  | 'roic'
  | 'roe'
  | 'grossMargin'
  | 'operatingMargin'
  | 'netMargin'
  | 'debtToEquity'
  | 'freeCashFlow'
  | 'dividendYield'
  | 'payoutRatio'
  | 'momentum12m'
  | 'volatility'

export interface MetricDefinition {
  key: MetricKey
  label: string
  /** `percent` values are stored as decimals and displayed ×100. */
  format: 'currency-millions' | 'ratio' | 'percent' | 'percent-points'
  min: number
  max: number
  step: number
}

export const METRICS: MetricDefinition[] = [
  { key: 'marketCap', label: 'Market cap (m)', format: 'currency-millions', min: 0, max: 400_000, step: 1_000 },
  { key: 'revenueGrowth', label: 'Revenue growth', format: 'percent', min: -0.2, max: 0.6, step: 0.01 },
  { key: 'epsGrowth', label: 'EPS growth', format: 'percent', min: -0.2, max: 0.6, step: 0.01 },
  { key: 'peRatio', label: 'P/E', format: 'ratio', min: 0, max: 80, step: 1 },
  { key: 'forwardPe', label: 'Forward P/E', format: 'ratio', min: 0, max: 80, step: 1 },
  { key: 'pegRatio', label: 'PEG', format: 'ratio', min: 0, max: 10, step: 0.1 },
  { key: 'evToEbitda', label: 'EV/EBITDA', format: 'ratio', min: 0, max: 40, step: 0.5 },
  { key: 'priceToFcf', label: 'Price/FCF', format: 'ratio', min: 0, max: 80, step: 1 },
  { key: 'roic', label: 'ROIC', format: 'percent', min: 0, max: 0.5, step: 0.01 },
  { key: 'roe', label: 'ROE', format: 'percent', min: 0, max: 0.5, step: 0.01 },
  { key: 'grossMargin', label: 'Gross margin', format: 'percent', min: 0, max: 1, step: 0.01 },
  { key: 'operatingMargin', label: 'Operating margin', format: 'percent', min: 0, max: 0.6, step: 0.01 },
  { key: 'netMargin', label: 'Net margin', format: 'percent', min: 0, max: 0.5, step: 0.01 },
  { key: 'debtToEquity', label: 'Debt/equity', format: 'ratio', min: 0, max: 3, step: 0.05 },
  { key: 'freeCashFlow', label: 'Free cash flow (m)', format: 'currency-millions', min: 0, max: 20_000, step: 100 },
  { key: 'dividendYield', label: 'Dividend yield', format: 'percent-points', min: 0, max: 10, step: 0.1 },
  { key: 'payoutRatio', label: 'Payout ratio', format: 'percent', min: 0, max: 1.5, step: 0.05 },
  { key: 'momentum12m', label: '12M momentum', format: 'percent-points', min: -60, max: 120, step: 1 },
  { key: 'volatility', label: 'Volatility (annualised)', format: 'percent-points', min: 0, max: 80, step: 1 },
]

export interface RangeFilter {
  min?: number
  max?: number
}

export interface ScreenerCriteria {
  sectors?: string[]
  industries?: string[]
  countries?: string[]
  ranges?: Partial<Record<MetricKey, RangeFilter>>
}

export interface ScreenerRow {
  ticker: string
  name: string
  sector: string
  industry: string
  country: string
  currency: string
  price: number
  metrics: Record<MetricKey, number>
}

function metricValue(fundamentals: Fundamentals, key: MetricKey): number {
  return fundamentals[key]
}

export function toRow(company: CompanyRecord): ScreenerRow {
  const metrics = {} as Record<MetricKey, number>
  for (const metric of METRICS) metrics[metric.key] = metricValue(company.fundamentals, metric.key)
  return {
    ticker: company.security.ticker,
    name: company.security.name,
    sector: company.security.sector,
    industry: company.security.industry,
    country: company.security.country,
    currency: company.security.currency,
    price: company.prices[company.prices.length - 1].close,
    metrics,
  }
}

function matchesList(value: string, list?: string[]): boolean {
  return !list || list.length === 0 || list.includes(value)
}

function matchesRange(value: number, filter?: RangeFilter): boolean {
  if (!filter) return true
  if (filter.min !== undefined && value < filter.min) return false
  if (filter.max !== undefined && value > filter.max) return false
  return true
}

export function screen(
  criteria: ScreenerCriteria,
  universe: CompanyRecord[] = UNIVERSE,
): ScreenerRow[] {
  return universe
    .filter(
      (company) =>
        matchesList(company.security.sector, criteria.sectors) &&
        matchesList(company.security.industry, criteria.industries) &&
        matchesList(company.security.country, criteria.countries),
    )
    .map(toRow)
    .filter((row) =>
      METRICS.every((metric) => matchesRange(row.metrics[metric.key], criteria.ranges?.[metric.key])),
    )
}

export type SortDirection = 'asc' | 'desc'

export function sortRows(rows: ScreenerRow[], key: MetricKey | 'ticker', direction: SortDirection): ScreenerRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (key === 'ticker') return a.ticker.localeCompare(b.ticker)
    return a.metrics[key] - b.metrics[key]
  })
  return direction === 'asc' ? sorted : sorted.reverse()
}

export interface SavedScreen {
  id: string
  name: string
  criteria: ScreenerCriteria
  createdAt: string
}

export function createSavedScreen(
  id: string,
  name: string,
  criteria: ScreenerCriteria,
  createdAt: string,
): SavedScreen {
  return { id, name, criteria: structuredClone(criteria), createdAt }
}

/** Side-by-side comparison of selected tickers across every screener metric. */
export function compareRows(
  rows: ScreenerRow[],
  tickers: string[],
): { metric: MetricDefinition; values: { ticker: string; value: number | null }[] }[] {
  return METRICS.map((metric) => ({
    metric,
    values: tickers.map((ticker) => {
      const row = rows.find((candidate) => candidate.ticker === ticker)
      return { ticker, value: row ? row.metrics[metric.key] : null }
    }),
  }))
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function toCsv(rows: ScreenerRow[]): string {
  const header = ['Ticker', 'Name', 'Sector', 'Industry', 'Country', 'Currency', 'Price', ...METRICS.map((m) => m.label)]
  const lines = rows.map((row) =>
    [
      row.ticker,
      row.name,
      row.sector,
      row.industry,
      row.country,
      row.currency,
      String(row.price),
      ...METRICS.map((metric) => String(row.metrics[metric.key])),
    ]
      .map(escapeCsv)
      .join(','),
  )
  return [header.map(escapeCsv).join(','), ...lines].join('\n')
}

/**
 * SpreadsheetML keeps the export dependency-free while still opening as a
 * genuine worksheet in Excel, Numbers and LibreOffice.
 */
export function toXlsxXml(rows: ScreenerRow[]): string {
  const header = ['Ticker', 'Name', 'Sector', 'Industry', 'Country', 'Currency', 'Price', ...METRICS.map((m) => m.label)]
  const cell = (value: string | number) =>
    typeof value === 'number'
      ? `<Cell><Data ss:Type="Number">${value}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</Data></Cell>`
  const body = rows
    .map(
      (row) =>
        `<Row>${[
          cell(row.ticker),
          cell(row.name),
          cell(row.sector),
          cell(row.industry),
          cell(row.country),
          cell(row.currency),
          cell(row.price),
          ...METRICS.map((metric) => cell(row.metrics[metric.key])),
        ].join('')}</Row>`,
    )
    .join('')
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Screen"><Table><Row>${header
    .map(cell)
    .join('')}</Row>${body}</Table></Worksheet></Workbook>`
}
