import { describeProvenance } from './format'
import type { Provenance, ResearchReport } from './types'

/**
 * Research reports freeze the data snapshot, assumptions and calculation
 * versions used at generation time, so a stored report never changes when the
 * live data behind it changes.
 */

export const MODEL_VERSION = 'interpretation-rules-1.0.0'
export const CALCULATION_VERSION = 'analytics-1.0.0'

export interface ReportInput {
  id: string
  title: string
  module: string
  ticker: string | null
  createdAt: string
  assumptions: Record<string, number | string | null>
  snapshot: Record<string, number | string | null>
  sources: Provenance[]
}

export function createReport(input: ReportInput): ResearchReport {
  return {
    id: input.id,
    title: input.title,
    module: input.module,
    ticker: input.ticker,
    createdAt: input.createdAt,
    assumptions: { ...input.assumptions },
    snapshot: { ...input.snapshot },
    sources: input.sources.map((source) => ({ ...source })),
    modelVersion: MODEL_VERSION,
    calculationVersion: CALCULATION_VERSION,
  }
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

export function reportToCsv(report: ResearchReport): string {
  const rows: string[][] = [['Section', 'Field', 'Value']]
  rows.push(['Report', 'Title', report.title])
  rows.push(['Report', 'Module', report.module])
  rows.push(['Report', 'Ticker', report.ticker ?? 'n/a'])
  rows.push(['Report', 'Created', report.createdAt])
  rows.push(['Report', 'Model version', report.modelVersion])
  rows.push(['Report', 'Calculation version', report.calculationVersion])
  for (const [key, value] of Object.entries(report.assumptions)) {
    rows.push(['Assumption', key, value === null ? 'n/a' : String(value)])
  }
  for (const [key, value] of Object.entries(report.snapshot)) {
    rows.push(['Result', key, value === null ? 'n/a' : String(value)])
  }
  for (const source of report.sources) {
    rows.push(['Source', source.provider, describeProvenance(source)])
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function tableRows(record: Record<string, number | string | null>): string {
  return Object.entries(record)
    .map(
      ([key, value]) =>
        `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value === null ? 'Not available' : String(value))}</td></tr>`,
    )
    .join('')
}

/**
 * Print-ready HTML. The browser's print-to-PDF pipeline turns this into the
 * PDF export without pulling in a rendering dependency.
 */
export function reportToHtml(report: ResearchReport): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    `<title>${escapeHtml(report.title)}</title>`,
    '<style>body{font-family:system-ui,sans-serif;margin:32px;color:#0f172a}h1{margin-bottom:4px}',
    'table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #cbd5f5;padding:6px 10px;text-align:left;font-size:13px}',
    'th{background:#eef2ff;width:40%}</style></head><body>',
    `<h1>${escapeHtml(report.title)}</h1>`,
    `<p>${escapeHtml(report.module)} · ${escapeHtml(report.ticker ?? 'portfolio')} · generated ${escapeHtml(report.createdAt)}</p>`,
    '<h2>Assumptions</h2><table>',
    tableRows(report.assumptions),
    '</table><h2>Results at generation time</h2><table>',
    tableRows(report.snapshot),
    '</table><h2>Sources</h2><ul>',
    report.sources.map((source) => `<li>${escapeHtml(describeProvenance(source))}</li>`).join(''),
    '</ul>',
    `<p><small>Model ${escapeHtml(report.modelVersion)} · calculation ${escapeHtml(report.calculationVersion)}. Figures are a frozen snapshot and do not update with live data.</small></p>`,
    '</body></html>',
  ].join('')
}
