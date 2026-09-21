import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TERMINAL_GROWTH,
  EQUITY_RISK_PREMIUM,
  RISK_FREE_RATE,
  assumptionsFromCompany,
  forecast,
  scenarios,
  sensitivityMatrix,
  terminalValueExitMultiple,
  terminalValuePerpetuity,
  valueDcf,
  type DcfAssumptions,
} from './dcf'
import { UNIVERSE } from './universe'

/** A deliberately clean assumption set so the arithmetic is hand-verifiable. */
const base: DcfAssumptions = {
  revenue: 1000,
  revenueGrowth: [0.1, 0.1, 0.1, 0.1, 0.1],
  operatingMargin: 0.2,
  taxRate: 0.25,
  depreciationPercentOfRevenue: 0.05,
  capexPercentOfRevenue: 0.07,
  workingCapitalPercentOfRevenue: 0.01,
  wacc: 0.1,
  terminalGrowth: 0.02,
  exitMultiple: 10,
  netDebt: 100,
  dilutedShares: 100,
  currentPrice: 50,
}

describe('forecast', () => {
  it('projects free cash flow with hand-computed values', () => {
    const years = forecast(base)
    expect(years).toHaveLength(5)
    expect(years[0]).toEqual({
      year: 1,
      revenue: 1100,
      ebit: 220,
      taxes: 55,
      nopat: 165,
      depreciation: 55,
      capex: 77,
      workingCapitalChange: 11,
      freeCashFlow: 132,
      discountFactor: 0.909091,
      presentValue: 120,
    })
    // Every year's PV is exactly 120 for this geometric series.
    expect(years.map((year) => year.presentValue)).toEqual([120, 120, 120, 120, 120])
    expect(years[4].revenue).toBeCloseTo(1610.51, 2)
  })
})

describe('terminalValuePerpetuity', () => {
  it('computes the Gordon growth terminal value', () => {
    // 100 * 1.02 / (0.10 - 0.02) = 1275
    expect(terminalValuePerpetuity(100, 0.1, 0.02)).toBeCloseTo(1275, 6)
  })

  it('returns null when wacc does not exceed terminal growth', () => {
    expect(terminalValuePerpetuity(100, 0.02, 0.02)).toBeNull()
    expect(terminalValuePerpetuity(100, 0.01, 0.02)).toBeNull()
  })
})

describe('terminalValueExitMultiple', () => {
  it('applies the multiple to terminal-year EBITDA', () => {
    const years = forecast(base)
    // EBITDA = ebit(322.1) + depreciation(80.53) = 402.63; * 10 = 4026.3
    expect(terminalValueExitMultiple(base, years)).toBeCloseTo(4026.3, 1)
  })
})

describe('valueDcf', () => {
  it('values a company via the perpetuity method by default', () => {
    const result = valueDcf(base)
    expect(result.method).toBe('perpetuity')
    expect(result.pvOfForecast).toBe(600)
    expect(result.terminalValue).toBeCloseTo(2464.065, 2)
    expect(result.pvOfTerminalValue).toBeCloseTo(1529.99, 1)
    expect(result.enterpriseValue).toBeCloseTo(2129.99, 1)
    expect(result.equityValue).toBeCloseTo(2029.99, 1)
    expect(result.valuePerShare).toBeCloseTo(20.3, 2)
    expect(result.upsidePercent).toBeCloseTo(-59.4, 1)
    expect(result.currentPrice).toBe(50)
  })

  it('values a company via the exit-multiple method', () => {
    const result = valueDcf(base, 'exit-multiple')
    expect(result.method).toBe('exit-multiple')
    expect(result.terminalValue).toBeCloseTo(4026.3, 1)
    expect(result.valuePerShare).toBeCloseTo(30, 1)
    expect(result.upsidePercent).toBeCloseTo(-40, 1)
  })

  it('propagates null when the terminal value is undefined', () => {
    const result = valueDcf({ ...base, wacc: 0.02, terminalGrowth: 0.02 })
    expect(result.terminalValue).toBeNull()
    expect(result.pvOfTerminalValue).toBeNull()
    expect(result.enterpriseValue).toBeNull()
    expect(result.equityValue).toBeNull()
    expect(result.valuePerShare).toBeNull()
    expect(result.upsidePercent).toBeNull()
  })

  it('returns null per-share value when there are no shares', () => {
    const result = valueDcf({ ...base, dilutedShares: 0 }, 'exit-multiple')
    expect(result.equityValue).not.toBeNull()
    expect(result.valuePerShare).toBeNull()
    expect(result.upsidePercent).toBeNull()
  })

  it('returns null upside when the current price is zero', () => {
    const result = valueDcf({ ...base, currentPrice: 0 }, 'exit-multiple')
    expect(result.valuePerShare).not.toBeNull()
    expect(result.upsidePercent).toBeNull()
  })
})

describe('scenarios', () => {
  it('orders bear/base/bull and increases value with optimism', () => {
    const results = scenarios(base)
    expect(results.map((scenario) => scenario.name)).toEqual(['bear', 'base', 'bull'])
    const [bear, baseCase, bull] = results
    expect(bear.result.method).toBe('perpetuity')
    expect(bear.result.valuePerShare).not.toBeNull()
    expect(baseCase.result.valuePerShare).not.toBeNull()
    expect(bull.result.valuePerShare).not.toBeNull()
    expect(bear.result.valuePerShare as number).toBeLessThan(baseCase.result.valuePerShare as number)
    expect(bull.result.valuePerShare as number).toBeGreaterThan(baseCase.result.valuePerShare as number)
  })

  it('passes the valuation method through to every scenario', () => {
    const results = scenarios(base, 'exit-multiple')
    expect(results.every((scenario) => scenario.result.method === 'exit-multiple')).toBe(true)
  })
})

describe('sensitivityMatrix', () => {
  it('builds a default WACC x terminal-growth grid', () => {
    const grid = sensitivityMatrix(base, 'terminalGrowth')
    expect(grid).toHaveLength(5)
    expect(grid[0].cells).toHaveLength(5)
    grid.map((row) => row.wacc).forEach((wacc, index) => {
      expect(wacc).toBeCloseTo([0.08, 0.09, 0.1, 0.11, 0.12][index], 10)
    })
    grid[2].cells
      .map((cell) => cell.axisValue)
      .forEach((axisValue, index) => {
        expect(axisValue).toBeCloseTo([0.01, 0.015, 0.02, 0.025, 0.03][index], 10)
      })
    // Centre cell reproduces the base perpetuity valuation.
    expect(grid[2].cells[2].valuePerShare).toBeCloseTo(20.3, 1)
  })

  it('builds a default WACC x exit-multiple grid', () => {
    const grid = sensitivityMatrix(base, 'exitMultiple')
    expect(grid).toHaveLength(5)
    expect(grid[2].cells.map((cell) => cell.axisValue)).toEqual([8, 9, 10, 11, 12])
    expect(grid[2].cells[2].valuePerShare).toBeCloseTo(30, 1)
  })

  it('honours custom step arrays', () => {
    const grid = sensitivityMatrix(base, 'exitMultiple', [0.1], [10])
    expect(grid).toHaveLength(1)
    expect(grid[0].wacc).toBe(0.1)
    expect(grid[0].cells).toHaveLength(1)
    expect(grid[0].cells[0].axisValue).toBe(10)
    expect(grid[0].cells[0].valuePerShare).toBeCloseTo(30, 1)
  })
})

describe('assumptionsFromCompany', () => {
  it('derives assumptions from fundamentals', () => {
    const company = UNIVERSE[0]
    const f = company.fundamentals
    const a = assumptionsFromCompany(company)
    expect(a.revenue).toBe(f.revenue)
    expect(a.revenueGrowth).toHaveLength(5)
    expect(a.operatingMargin).toBe(f.operatingMargin)
    expect(a.taxRate).toBe(f.taxRate)
    expect(a.depreciationPercentOfRevenue).toBeCloseTo(f.depreciation / f.revenue, 10)
    expect(a.capexPercentOfRevenue).toBeCloseTo(f.capex / f.revenue, 10)
    expect(a.workingCapitalPercentOfRevenue).toBeCloseTo(f.workingCapitalChange / f.revenue, 10)
    expect(a.wacc).toBeCloseTo(RISK_FREE_RATE + f.beta * EQUITY_RISK_PREMIUM, 10)
    expect(a.terminalGrowth).toBe(DEFAULT_TERMINAL_GROWTH)
    expect(a.exitMultiple).toBe(f.evToEbitda)
    expect(a.netDebt).toBe(f.netDebt)
    expect(a.dilutedShares).toBe(f.dilutedShares)
    expect(a.currentPrice).toBe(company.prices[company.prices.length - 1].close)
    // Growth decays toward the terminal rate.
    const gap = (rate: number) => Math.abs(rate - DEFAULT_TERMINAL_GROWTH)
    expect(gap(a.revenueGrowth[4])).toBeLessThan(gap(a.revenueGrowth[0]))
    expect(a.revenueGrowth[4]).toBeCloseTo(DEFAULT_TERMINAL_GROWTH, 10)
  })
})

describe('exported constants', () => {
  it('exposes the CAPM inputs', () => {
    expect(RISK_FREE_RATE).toBe(0.042)
    expect(EQUITY_RISK_PREMIUM).toBe(0.05)
    expect(DEFAULT_TERMINAL_GROWTH).toBe(0.025)
  })
})
