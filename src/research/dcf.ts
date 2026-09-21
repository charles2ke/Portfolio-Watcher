import { roundTo } from '../lib/numbers'
import type { CompanyRecord } from './types'

/**
 * Deterministic discounted-cash-flow valuation engine.
 *
 * Every output recalculates purely from its `DcfAssumptions` — there is no
 * randomness and no hidden state. When the inputs make a value genuinely
 * undefined (for example a terminal value where WACC does not exceed the
 * terminal growth rate) the engine returns `null` rather than inventing a
 * number.
 */

/** Risk-free rate used to bootstrap a WACC estimate from a company's beta. */
export const RISK_FREE_RATE = 0.042
/** Equity risk premium applied to beta when estimating WACC. */
export const EQUITY_RISK_PREMIUM = 0.05
/** Long-run terminal growth assumption used as the decay target. */
export const DEFAULT_TERMINAL_GROWTH = 0.025

const FORECAST_YEARS = 5

export interface DcfAssumptions {
  revenue: number
  /** Five yearly revenue growth rates as decimals. */
  revenueGrowth: number[]
  operatingMargin: number
  taxRate: number
  depreciationPercentOfRevenue: number
  capexPercentOfRevenue: number
  workingCapitalPercentOfRevenue: number
  wacc: number
  terminalGrowth: number
  exitMultiple: number
  netDebt: number
  dilutedShares: number
  currentPrice: number
}

export interface ForecastYear {
  year: number
  revenue: number
  ebit: number
  taxes: number
  nopat: number
  depreciation: number
  capex: number
  workingCapitalChange: number
  freeCashFlow: number
  discountFactor: number
  presentValue: number
}

export interface DcfResult {
  years: ForecastYear[]
  pvOfForecast: number
  terminalValue: number | null
  pvOfTerminalValue: number | null
  enterpriseValue: number | null
  equityValue: number | null
  valuePerShare: number | null
  currentPrice: number
  upsidePercent: number | null
  method: 'perpetuity' | 'exit-multiple'
}

export interface ScenarioResult {
  name: 'bear' | 'base' | 'bull'
  result: DcfResult
}

/** Rounds a monetary output to two decimals. */
function money(value: number): number {
  return roundTo(value, 2)
}

/**
 * Derives a sensible set of DCF assumptions from a company's fundamentals.
 *
 * Revenue growth decays linearly from the trailing growth rate toward the
 * terminal growth rate over the forecast horizon, and WACC is estimated from
 * beta via the capital asset pricing model.
 */
export function assumptionsFromCompany(company: CompanyRecord): DcfAssumptions {
  const f = company.fundamentals
  const terminalGrowth = DEFAULT_TERMINAL_GROWTH
  const revenueGrowth = Array.from(
    { length: FORECAST_YEARS },
    (_, index) => f.revenueGrowth + (terminalGrowth - f.revenueGrowth) * ((index + 1) / FORECAST_YEARS),
  )
  const lastClose = company.prices[company.prices.length - 1].close
  return {
    revenue: f.revenue,
    revenueGrowth,
    operatingMargin: f.operatingMargin,
    taxRate: f.taxRate,
    depreciationPercentOfRevenue: f.depreciation / f.revenue,
    capexPercentOfRevenue: f.capex / f.revenue,
    workingCapitalPercentOfRevenue: f.workingCapitalChange / f.revenue,
    wacc: RISK_FREE_RATE + f.beta * EQUITY_RISK_PREMIUM,
    terminalGrowth,
    exitMultiple: f.evToEbitda,
    netDebt: f.netDebt,
    dilutedShares: f.dilutedShares,
    currentPrice: lastClose,
  }
}

/** Projects five years of unlevered free cash flow and its present value. */
export function forecast(a: DcfAssumptions): ForecastYear[] {
  const years: ForecastYear[] = []
  let revenue = a.revenue
  for (let index = 0; index < a.revenueGrowth.length; index += 1) {
    revenue = revenue * (1 + a.revenueGrowth[index])
    const ebit = revenue * a.operatingMargin
    const taxes = ebit * a.taxRate
    const nopat = ebit - taxes
    const depreciation = revenue * a.depreciationPercentOfRevenue
    const capex = revenue * a.capexPercentOfRevenue
    const workingCapitalChange = revenue * a.workingCapitalPercentOfRevenue
    const freeCashFlow = nopat + depreciation - capex - workingCapitalChange
    const period = index + 1
    const discountFactor = roundTo(1 / (1 + a.wacc) ** period, 6)
    years.push({
      year: period,
      revenue: money(revenue),
      ebit: money(ebit),
      taxes: money(taxes),
      nopat: money(nopat),
      depreciation: money(depreciation),
      capex: money(capex),
      workingCapitalChange: money(workingCapitalChange),
      freeCashFlow: money(freeCashFlow),
      discountFactor,
      presentValue: money(freeCashFlow * discountFactor),
    })
  }
  return years
}

/**
 * Gordon-growth terminal value. Returns `null` when WACC does not exceed the
 * terminal growth rate, because the perpetuity is then undefined.
 */
export function terminalValuePerpetuity(
  lastFcf: number,
  wacc: number,
  terminalGrowth: number,
): number | null {
  if (wacc <= terminalGrowth) return null
  return (lastFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth)
}

/** Terminal value from an EV/EBITDA exit multiple on terminal-year EBITDA. */
export function terminalValueExitMultiple(a: DcfAssumptions, years: ForecastYear[]): number {
  const last = years[years.length - 1]
  const ebitda = last.ebit + last.depreciation
  return a.exitMultiple * ebitda
}

/** Runs a full DCF, propagating `null` whenever the terminal value is unavailable. */
export function valueDcf(a: DcfAssumptions, method: 'perpetuity' | 'exit-multiple' = 'perpetuity'): DcfResult {
  const years = forecast(a)
  const pvOfForecast = money(years.reduce((sum, year) => sum + year.presentValue, 0))
  const last = years[years.length - 1]
  const terminalValue =
    method === 'perpetuity'
      ? terminalValuePerpetuity(last.freeCashFlow, a.wacc, a.terminalGrowth)
      : terminalValueExitMultiple(a, years)
  const pvOfTerminalValue = terminalValue === null ? null : money(terminalValue * last.discountFactor)
  const enterpriseValue = pvOfTerminalValue === null ? null : money(pvOfForecast + pvOfTerminalValue)
  const equityValue = enterpriseValue === null ? null : money(enterpriseValue - a.netDebt)
  const valuePerShare =
    equityValue === null || a.dilutedShares === 0 ? null : money(equityValue / a.dilutedShares)
  const upsidePercent =
    valuePerShare === null || a.currentPrice === 0
      ? null
      : money(((valuePerShare - a.currentPrice) / a.currentPrice) * 100)
  return {
    years,
    pvOfForecast,
    terminalValue,
    pvOfTerminalValue,
    enterpriseValue,
    equityValue,
    valuePerShare,
    currentPrice: a.currentPrice,
    upsidePercent,
    method,
  }
}

interface ScenarioAdjustment {
  growth: number
  margin: number
  wacc: number
}

const SCENARIO_ADJUSTMENTS: Record<ScenarioResult['name'], ScenarioAdjustment> = {
  bear: { growth: -0.03, margin: -0.02, wacc: 0.01 },
  base: { growth: 0, margin: 0, wacc: 0 },
  bull: { growth: 0.03, margin: 0.02, wacc: -0.01 },
}

/** Builds bear/base/bull scenarios by deterministically nudging the drivers. */
export function scenarios(
  a: DcfAssumptions,
  method?: 'perpetuity' | 'exit-multiple',
): ScenarioResult[] {
  const names: ScenarioResult['name'][] = ['bear', 'base', 'bull']
  return names.map((name) => {
    const adjustment = SCENARIO_ADJUSTMENTS[name]
    const adjusted: DcfAssumptions = {
      ...a,
      revenueGrowth: a.revenueGrowth.map((growth) => growth + adjustment.growth),
      operatingMargin: a.operatingMargin + adjustment.margin,
      wacc: a.wacc + adjustment.wacc,
    }
    return { name, result: valueDcf(adjusted, method) }
  })
}

/**
 * Builds a WACC × axis grid of per-share values. The axis is either the
 * terminal growth rate (valued with the perpetuity method) or the exit
 * multiple (valued with the exit-multiple method).
 */
export function sensitivityMatrix(
  a: DcfAssumptions,
  axis: 'terminalGrowth' | 'exitMultiple',
  waccSteps?: number[],
  axisSteps?: number[],
): { wacc: number; cells: { axisValue: number; valuePerShare: number | null }[] }[] {
  const waccs = waccSteps ?? [a.wacc - 0.02, a.wacc - 0.01, a.wacc, a.wacc + 0.01, a.wacc + 0.02]
  const method = axis === 'terminalGrowth' ? 'perpetuity' : 'exit-multiple'
  const axisValues =
    axisSteps ??
    (axis === 'terminalGrowth'
      ? [
          a.terminalGrowth - 0.01,
          a.terminalGrowth - 0.005,
          a.terminalGrowth,
          a.terminalGrowth + 0.005,
          a.terminalGrowth + 0.01,
        ]
      : [a.exitMultiple - 2, a.exitMultiple - 1, a.exitMultiple, a.exitMultiple + 1, a.exitMultiple + 2])
  return waccs.map((wacc) => ({
    wacc,
    cells: axisValues.map((axisValue) => {
      const adjusted: DcfAssumptions =
        axis === 'terminalGrowth'
          ? { ...a, wacc, terminalGrowth: axisValue }
          : { ...a, wacc, exitMultiple: axisValue }
      return { axisValue, valuePerShare: valueDcf(adjusted, method).valuePerShare }
    }),
  }))
}
