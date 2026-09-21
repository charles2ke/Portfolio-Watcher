import { describe, expect, it } from 'vitest'
import {
  ALERT_TYPE_LABELS,
  daysBetween,
  defaultRules,
  evaluateRule,
  evaluateRules,
} from './researchAlerts'
import type { AlertRule } from './researchAlerts'
import { getCompany } from './universe'

const context = { today: '2026-09-18', holdings: [{ ticker: 'ARCL', weight: 30 }] }

function rule(overrides: Partial<AlertRule>): AlertRule {
  return { id: 'r', type: 'price', ticker: 'ARCL', threshold: 3, enabled: true, ...overrides }
}

describe('research alerts', () => {
  it('labels every alert type', () => {
    expect(Object.keys(ALERT_TYPE_LABELS)).toHaveLength(7)
  })

  it('measures whole days between dates', () => {
    expect(daysBetween('2026-09-18', '2026-09-25')).toBe(7)
    expect(daysBetween('2026-09-25', '2026-09-18')).toBe(-7)
  })

  it('ignores disabled rules, unknown tickers and rules without a ticker', () => {
    expect(evaluateRule(rule({ enabled: false }), context)).toBeNull()
    expect(evaluateRule(rule({ ticker: 'NOPE' }), context)).toBeNull()
    expect(evaluateRule(rule({ ticker: null }), context)).toBeNull()
    expect(evaluateRule(rule({ type: 'earnings', ticker: 'NOPE' }), context)).toBeNull()
    expect(evaluateRule(rule({ type: 'valuation', ticker: 'NOPE' }), context)).toBeNull()
    expect(evaluateRule(rule({ type: 'dividend', ticker: 'NOPE' }), context)).toBeNull()
    expect(evaluateRule(rule({ type: 'technical', ticker: 'NOPE' }), context)).toBeNull()
  })

  it('raises price alerts above the threshold only', () => {
    expect(evaluateRule(rule({ threshold: 100 }), context)).toBeNull()
    const closes = getCompany('ARCL')!.prices.map((point) => point.close)
    const change = Math.abs(
      Math.round(
        ((closes[closes.length - 1] - closes[closes.length - 2]) / closes[closes.length - 2]) * 10_000,
      ) / 100,
    )
    const alert = evaluateRule(rule({ threshold: change }), context)!
    expect(alert.type).toBe('price')
    expect(alert.severity).toBe('warning')
    expect(evaluateRule(rule({ threshold: change / 4 }), context)!.severity).toBe('critical')
  })

  it('raises earnings alerts inside the window', () => {
    expect(evaluateRule(rule({ type: 'earnings', threshold: 45 }), context)!.message).toContain(
      '2026-10-22',
    )
    expect(evaluateRule(rule({ type: 'earnings', threshold: 5 }), context)).toBeNull()
    expect(
      evaluateRule(rule({ type: 'earnings', threshold: 45 }), { ...context, today: '2026-12-01' }),
    ).toBeNull()
  })

  it('raises valuation alerts at or below the trigger', () => {
    expect(evaluateRule(rule({ type: 'valuation', threshold: 1 }), context)).toBeNull()
    expect(evaluateRule(rule({ type: 'valuation', threshold: 500 }), context)!.type).toBe('valuation')
  })

  it('reports dividend payout pressure and missing dividend data', () => {
    expect(evaluateRule(rule({ type: 'dividend', ticker: 'NBLA', threshold: 0.6 }), context)!.message).toContain(
      'no dividend record',
    )
    expect(evaluateRule(rule({ type: 'dividend', threshold: 0.9 }), context)).toBeNull()
    expect(evaluateRule(rule({ type: 'dividend', threshold: 0 }), context)!.severity).toBe('warning')
  })

  it('describes technical crosses probabilistically', () => {
    expect(evaluateRule(rule({ type: 'technical', threshold: 10_000 }), context)).toBeNull()
    const results = ['ARCL', 'NBLA', 'HLVT', 'RVRT', 'MDCR', 'TERA', 'AQFL', 'KNSU']
      .flatMap((ticker) =>
        [5, 10, 20, 50].map((threshold) =>
          evaluateRule(rule({ type: 'technical', ticker, threshold }), context),
        ),
      )
      .filter((alert) => alert !== null)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.message).toContain('not a forecast')
  })

  it('raises concentration and macro alerts', () => {
    expect(evaluateRule(rule({ type: 'concentration', ticker: null, threshold: 25 }), context)!.message).toContain(
      'ARCL',
    )
    expect(evaluateRule(rule({ type: 'concentration', ticker: null, threshold: 90 }), context)).toBeNull()
    expect(evaluateRule(rule({ type: 'macro', ticker: null, threshold: 10 }), context)!.message).toContain(
      'Central bank',
    )
    expect(evaluateRule(rule({ type: 'macro', ticker: null, threshold: 1 }), context)).toBeNull()
  })

  it('evaluates a rule set and builds sensible defaults', () => {
    const rules = defaultRules(['ARCL'])
    expect(rules).toHaveLength(4)
    const alerts = evaluateRules(rules, context)
    expect(alerts.every((alert) => alert.message.length > 0)).toBe(true)
    expect(alerts.some((alert) => alert.type === 'macro')).toBe(true)
  })
})
