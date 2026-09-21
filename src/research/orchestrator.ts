import { getCompany } from './universe'
import { peerSet } from './competition'
import { MACRO_SERIES, latestValue } from './macro'
import { NOT_AVAILABLE } from './format'
import { roundTo } from '../lib/numbers'
import type { CompanyRecord, Provenance } from './types'

/**
 * Research orchestration (the interpretation layer).
 *
 * Calculations happen in the dedicated analytics engines; this module only
 * assembles the grounded context and turns already-calculated numbers into
 * prose. It never invents a figure: anything the data services could not
 * supply is surfaced in `missing` instead.
 */

export interface GroundingBundle {
  ticker: string
  security: CompanyRecord['security']
  marketData: { price: number; changePercent: number; currency: string }
  financials: Record<string, number>
  calculatedMetrics: Record<string, number | null>
  peerMedians: Record<string, number | null>
  macro: Record<string, number>
  assumptions: Record<string, number | string | null>
  /** Anything the data services could not supply, named explicitly. */
  missing: string[]
  sources: Provenance[]
}

/** Median of the peer values, or `null` when there are no peers to compare. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? roundTo((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle]
}

export function buildGrounding(
  ticker: string,
  assumptions: Record<string, number | string | null> = {},
): GroundingBundle | null {
  const company = getCompany(ticker)
  if (!company) return null
  const prices = company.prices
  const last = prices[prices.length - 1].close
  const previous = prices[prices.length - 2].close
  const peers = peerSet(ticker)
  const missing: string[] = []
  if (!company.options) missing.push('Options chain (market-implied earnings move)')
  if (!company.dividend) missing.push('Dividend history')
  if (!company.marketShare) missing.push('Market-share history')
  if (company.innovation.length === 0) missing.push('Sourced qualitative commentary')
  const f = company.fundamentals
  return {
    ticker: company.security.ticker,
    security: company.security,
    marketData: {
      price: last,
      changePercent: roundTo(((last - previous) / previous) * 100),
      currency: company.security.currency,
    },
    financials: {
      revenue: f.revenue,
      freeCashFlow: f.freeCashFlow,
      eps: f.eps,
      netDebt: f.netDebt,
      dilutedShares: f.dilutedShares,
      researchAndDevelopment: f.researchAndDevelopment,
    },
    calculatedMetrics: {
      forwardPe: f.forwardPe,
      pegRatio: f.pegRatio,
      evToEbitda: f.evToEbitda,
      revenueGrowth: roundTo(f.revenueGrowth * 100),
      operatingMargin: roundTo(f.operatingMargin * 100),
      roic: roundTo(f.roic * 100),
      debtToEquity: f.debtToEquity,
      dividendYield: company.dividend ? f.dividendYield : null,
      fcfPayoutRatio: company.dividend ? roundTo(company.dividend.fcfPayoutRatio * 100) : null,
      momentum12m: f.momentum12m,
    },
    peerMedians: {
      forwardPe: median(peers.map((peer) => peer.fundamentals.forwardPe)),
      operatingMargin: median(peers.map((peer) => roundTo(peer.fundamentals.operatingMargin * 100))),
      revenueGrowth: median(peers.map((peer) => roundTo(peer.fundamentals.revenueGrowth * 100))),
    },
    macro: Object.fromEntries(
      MACRO_SERIES.filter((series) => ['policy-rate', 'cpi', 'gdp'].includes(series.id)).map(
        (series) => [series.id, latestValue(series)],
      ),
    ),
    assumptions,
    missing,
    sources: [company.provenance, ...MACRO_SERIES.slice(0, 1).map((series) => series.provenance)],
  }
}

export interface InterpretationSection {
  title: string
  body: string
  /** Names of the grounded values the sentence was derived from. */
  basis: string[]
}

export interface Interpretation {
  headline: string
  sections: InterpretationSection[]
  missing: string[]
  disclaimer: string
}

export const INTERPRETATION_DISCLAIMER =
  'Written by the rule-based interpretation layer from the calculated results above. Every figure is taken from the grounded data; nothing is estimated by the narrative layer. This is research, not investment advice.'

function compare(value: number | null, peer: number | null, richer: string, cheaper: string): string {
  if (value === null || peer === null) return NOT_AVAILABLE
  if (value > peer) return richer
  return cheaper
}

export function interpret(bundle: GroundingBundle): Interpretation {
  const m = bundle.calculatedMetrics
  const sections: InterpretationSection[] = [
    {
      title: 'Valuation',
      body: `${bundle.ticker} trades at ${m.forwardPe}x forward earnings against a peer median of ${bundle.peerMedians.forwardPe ?? 'n/a'}x, ${compare(m.forwardPe, bundle.peerMedians.forwardPe, 'a premium to the peer set', 'a discount to the peer set')}. EV/EBITDA is ${m.evToEbitda}x and PEG is ${m.pegRatio}.`,
      basis: ['calculatedMetrics.forwardPe', 'peerMedians.forwardPe', 'calculatedMetrics.evToEbitda'],
    },
    {
      title: 'Growth',
      body: `Revenue growth of ${m.revenueGrowth}% compares with a peer median of ${bundle.peerMedians.revenueGrowth ?? 'n/a'}%, and 12-month price momentum is ${m.momentum12m}%.`,
      basis: ['calculatedMetrics.revenueGrowth', 'peerMedians.revenueGrowth', 'calculatedMetrics.momentum12m'],
    },
    {
      title: 'Balance sheet quality',
      body: `Debt/equity is ${m.debtToEquity} with net debt of ${bundle.financials.netDebt}m ${bundle.security.currency} against ${bundle.financials.freeCashFlow}m of free cash flow.`,
      basis: ['calculatedMetrics.debtToEquity', 'financials.netDebt', 'financials.freeCashFlow'],
    },
    {
      title: 'Dividend sustainability',
      body:
        m.dividendYield === null
          ? `${NOT_AVAILABLE}: the security has no dividend record.`
          : `The ${m.dividendYield}% yield consumes ${m.fcfPayoutRatio}% of free cash flow.`,
      basis: ['calculatedMetrics.dividendYield', 'calculatedMetrics.fcfPayoutRatio'],
    },
    {
      title: 'Competitive positioning',
      body: `Operating margin of ${m.operatingMargin}% versus a peer median of ${bundle.peerMedians.operatingMargin ?? 'n/a'}%, with ROIC at ${m.roic}%.`,
      basis: ['calculatedMetrics.operatingMargin', 'peerMedians.operatingMargin', 'calculatedMetrics.roic'],
    },
    {
      title: 'Bull and bear cases',
      body: `Bull: margins and ROIC (${m.roic}%) hold while growth stays near ${m.revenueGrowth}%. Bear: the multiple de-rates toward the peer median of ${bundle.peerMedians.forwardPe ?? 'n/a'}x with policy rates at ${bundle.macro['policy-rate']}%.`,
      basis: ['calculatedMetrics.roic', 'peerMedians.forwardPe', 'macro.policy-rate'],
    },
  ]
  return {
    headline: `${bundle.security.name} (${bundle.ticker}) · ${bundle.security.sector} · ${bundle.marketData.price} ${bundle.marketData.currency}`,
    sections,
    missing: bundle.missing,
    disclaimer: INTERPRETATION_DISCLAIMER,
  }
}
