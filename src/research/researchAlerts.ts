import { getCompany } from './universe'
import { MACRO_CALENDAR } from './macro'
import { roundTo } from '../lib/numbers'
import type { ResearchAlert, ResearchAlertType } from './types'

/** Rule-driven alerts across price, earnings, valuation, dividend, technical,
 * concentration and macro events. */

export interface AlertRule {
  id: string
  type: ResearchAlertType
  /** `null` for portfolio-wide or macro rules. */
  ticker: string | null
  threshold: number
  enabled: boolean
}

export interface AlertContext {
  today: string
  holdings: { ticker: string; weight: number }[]
}

export const ALERT_TYPE_LABELS: Record<ResearchAlertType, string> = {
  price: 'Price move',
  earnings: 'Earnings date',
  valuation: 'Valuation',
  dividend: 'Dividend',
  technical: 'Technical event',
  concentration: 'Portfolio concentration',
  macro: 'Macro release',
}

export function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime()
  const end = new Date(`${to}T00:00:00.000Z`).getTime()
  return Math.round((end - start) / 86_400_000)
}

function simpleAverage(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function priceAlert(rule: AlertRule, ticker: string): ResearchAlert | null {
  const company = getCompany(ticker)
  if (!company) return null
  const closes = company.prices.map((point) => point.close)
  const change = roundTo(((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 100)
  if (Math.abs(change) < rule.threshold) return null
  return {
    id: rule.id,
    type: 'price',
    subject: ticker,
    message: `${ticker} moved ${change.toFixed(2)}% on the last session (threshold ${rule.threshold}%).`,
    severity: Math.abs(change) >= rule.threshold * 2 ? 'critical' : 'warning',
  }
}

function earningsAlert(rule: AlertRule, ticker: string, today: string): ResearchAlert | null {
  const company = getCompany(ticker)
  if (!company) return null
  const days = daysBetween(today, company.nextEarningsDate)
  if (days < 0 || days > rule.threshold) return null
  return {
    id: rule.id,
    type: 'earnings',
    subject: ticker,
    message: `${ticker} reports in ${days} day(s) on ${company.nextEarningsDate}.`,
    severity: 'info',
  }
}

function valuationAlert(rule: AlertRule, ticker: string): ResearchAlert | null {
  const company = getCompany(ticker)
  if (!company) return null
  const { forwardPe } = company.fundamentals
  if (forwardPe > rule.threshold) return null
  return {
    id: rule.id,
    type: 'valuation',
    subject: ticker,
    message: `${ticker} trades at ${forwardPe.toFixed(2)}x forward earnings, at or below your ${rule.threshold}x trigger.`,
    severity: 'info',
  }
}

function dividendAlert(rule: AlertRule, ticker: string): ResearchAlert | null {
  const company = getCompany(ticker)
  if (!company) return null
  if (!company.dividend) {
    return {
      id: rule.id,
      type: 'dividend',
      subject: ticker,
      message: `${ticker} has no dividend record in the connected data sources.`,
      severity: 'info',
    }
  }
  if (company.dividend.fcfPayoutRatio < rule.threshold) return null
  return {
    id: rule.id,
    type: 'dividend',
    subject: ticker,
    message: `${ticker} pays out ${(company.dividend.fcfPayoutRatio * 100).toFixed(1)}% of free cash flow (threshold ${(rule.threshold * 100).toFixed(0)}%).`,
    severity: 'warning',
  }
}

function technicalAlert(rule: AlertRule, ticker: string): ResearchAlert | null {
  const company = getCompany(ticker)
  if (!company) return null
  const closes = company.prices.map((point) => point.close)
  const period = Math.max(2, Math.round(rule.threshold))
  if (closes.length <= period) return null
  const previousAverage = simpleAverage(closes.slice(-period - 1, -1))
  const currentAverage = simpleAverage(closes.slice(-period))
  const last = closes[closes.length - 1]
  const previous = closes[closes.length - 2]
  const crossedUp = previous <= previousAverage && last > currentAverage
  const crossedDown = previous >= previousAverage && last < currentAverage
  if (!crossedUp && !crossedDown) return null
  return {
    id: rule.id,
    type: 'technical',
    subject: ticker,
    message: `${ticker} crossed ${crossedUp ? 'above' : 'below'} its ${period}-day average — a signal, not a forecast.`,
    severity: 'info',
  }
}

function concentrationAlert(rule: AlertRule, context: AlertContext): ResearchAlert | null {
  const breach = context.holdings.filter((holding) => holding.weight >= rule.threshold)
  if (breach.length === 0) return null
  return {
    id: rule.id,
    type: 'concentration',
    subject: 'Portfolio',
    message: `${breach.map((holding) => `${holding.ticker} ${holding.weight.toFixed(1)}%`).join(', ')} exceed your ${rule.threshold}% position limit.`,
    severity: 'warning',
  }
}

function macroAlert(rule: AlertRule, today: string): ResearchAlert | null {
  const upcoming = MACRO_CALENDAR.filter((event) => {
    const days = daysBetween(today, event.date)
    return days >= 0 && days <= rule.threshold
  })
  if (upcoming.length === 0) return null
  return {
    id: rule.id,
    type: 'macro',
    subject: 'Macro',
    message: `${upcoming.map((event) => `${event.label} (${event.date})`).join(', ')} within ${rule.threshold} days.`,
    severity: 'info',
  }
}

export function evaluateRule(rule: AlertRule, context: AlertContext): ResearchAlert | null {
  if (!rule.enabled) return null
  if (rule.type === 'concentration') return concentrationAlert(rule, context)
  if (rule.type === 'macro') return macroAlert(rule, context.today)
  if (!rule.ticker) return null
  if (rule.type === 'price') return priceAlert(rule, rule.ticker)
  if (rule.type === 'earnings') return earningsAlert(rule, rule.ticker, context.today)
  if (rule.type === 'valuation') return valuationAlert(rule, rule.ticker)
  if (rule.type === 'dividend') return dividendAlert(rule, rule.ticker)
  return technicalAlert(rule, rule.ticker)
}

export function evaluateRules(rules: AlertRule[], context: AlertContext): ResearchAlert[] {
  return rules
    .map((rule) => evaluateRule(rule, context))
    .filter((alert): alert is ResearchAlert => alert !== null)
}

export function defaultRules(tickers: string[]): AlertRule[] {
  const rules: AlertRule[] = [
    { id: 'concentration-default', type: 'concentration', ticker: null, threshold: 25, enabled: true },
    { id: 'macro-default', type: 'macro', ticker: null, threshold: 7, enabled: true },
  ]
  for (const ticker of tickers) {
    rules.push({ id: `price-${ticker}`, type: 'price', ticker, threshold: 3, enabled: true })
    rules.push({ id: `earnings-${ticker}`, type: 'earnings', ticker, threshold: 45, enabled: true })
  }
  return rules
}
