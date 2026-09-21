import type { PricePoint } from './types'
import { getCompany } from './universe'

/**
 * Quantitative pattern research over the sample price history.
 *
 * Every statistic reports its sample size so noise is never presented as an
 * edge: t-statistics are `null` below three observations, significance requires
 * both |t| > 1.96 and at least twenty observations, and event studies warn when
 * too few events matched.
 */

const TRADING_DAYS_PER_YEAR = 252
const SIGNIFICANCE_T = 1.96
const MIN_SIGNIFICANT_OBSERVATIONS = 20

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Arithmetic mean; `0` for an empty series. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Median; `0` for an empty series. */
export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/** Sample standard deviation; `0` when fewer than two observations. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Population skewness; `0` when undefined (n < 3 or zero dispersion). */
export function skewness(values: number[]): number {
  const n = values.length
  if (n < 3) return 0
  const m = mean(values)
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / n)
  if (sd === 0) return 0
  const cubed = values.reduce((sum, value) => sum + ((value - m) / sd) ** 3, 0)
  return cubed / n
}

/** Population excess kurtosis; `0` when undefined (n < 4 or zero dispersion). */
export function kurtosis(values: number[]): number {
  const n = values.length
  if (n < 4) return 0
  const m = mean(values)
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / n)
  if (sd === 0) return 0
  const fourth = values.reduce((sum, value) => sum + ((value - m) / sd) ** 4, 0)
  return fourth / n - 3
}

/**
 * One-sample t-statistic against a zero mean; `null` when the sample is too
 * small (< 3) or has no dispersion.
 */
export function tStatistic(values: number[]): number | null {
  if (values.length < 3) return null
  const sd = stdDev(values)
  if (sd === 0) return null
  return (mean(values) * Math.sqrt(values.length)) / sd
}

/** Simple period-over-period returns as fractions. */
function returnsFrom(prices: PricePoint[]): number[] {
  const returns: number[] = []
  for (let index = 1; index < prices.length; index += 1) {
    returns.push((prices[index].close - prices[index - 1].close) / prices[index - 1].close)
  }
  return returns
}

export interface PeriodStat {
  period: string
  observations: number
  meanPercent: number
  medianPercent: number
  winRatePercent: number
  tStat: number | null
  significant: boolean
}

/** Builds a labelled statistic bundle from a set of fractional returns. */
function periodStat(period: string, values: number[]): PeriodStat {
  const observations = values.length
  const wins = values.filter((value) => value > 0).length
  const t = tStatistic(values)
  const tStat = t === null ? null : round(t, 3)
  return {
    period,
    observations,
    meanPercent: round(mean(values) * 100, 3),
    medianPercent: round(median(values) * 100, 3),
    winRatePercent: observations > 0 ? round((wins / observations) * 100) : 0,
    tStat,
    significant:
      tStat !== null && Math.abs(tStat) > SIGNIFICANCE_T && observations >= MIN_SIGNIFICANT_OBSERVATIONS,
  }
}

/** Calendar-month seasonality across the return series. */
export function monthlySeasonality(prices: PricePoint[]): PeriodStat[] {
  const buckets = new Map<number, number[]>()
  for (let index = 1; index < prices.length; index += 1) {
    const month = Number(prices[index].date.slice(5, 7)) - 1
    const change = (prices[index].close - prices[index - 1].close) / prices[index - 1].close
    const bucket = buckets.get(month) ?? []
    bucket.push(change)
    buckets.set(month, bucket)
  }
  return MONTH_NAMES.map((name, index) => periodStat(name, buckets.get(index) ?? []))
}

/** Day-of-week seasonality across the return series (trading days only). */
export function dayOfWeekSeasonality(prices: PricePoint[]): PeriodStat[] {
  const buckets = new Map<number, number[]>()
  for (let index = 1; index < prices.length; index += 1) {
    const day = new Date(`${prices[index].date}T00:00:00.000Z`).getUTCDay()
    const change = (prices[index].close - prices[index - 1].close) / prices[index - 1].close
    const bucket = buckets.get(day) ?? []
    bucket.push(change)
    buckets.set(day, bucket)
  }
  return [1, 2, 3, 4, 5].map((day) => periodStat(WEEKDAY_NAMES[day], buckets.get(day) ?? []))
}

function maxDrawdownPercent(prices: PricePoint[]): number {
  let peak = -Infinity
  let worst = 0
  for (const point of prices) {
    if (point.close > peak) peak = point.close
    const drawdown = (point.close - peak) / peak
    if (drawdown < worst) worst = drawdown
  }
  return round(Math.abs(worst) * 100)
}

/** Sample autocorrelation of a series at a given lag. */
function autocorrelation(values: number[], lag: number): number {
  if (values.length <= lag) return 0
  const m = mean(values)
  let numerator = 0
  let denominator = 0
  for (let index = 0; index < values.length; index += 1) {
    denominator += (values[index] - m) ** 2
  }
  for (let index = lag; index < values.length; index += 1) {
    numerator += (values[index] - m) * (values[index - lag] - m)
  }
  return denominator === 0 ? 0 : numerator / denominator
}

/** Histogram bucket edges (in percent) for the return distribution. */
const HISTOGRAM_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '< -3%', min: -Infinity, max: -3 },
  { label: '-3% to -1%', min: -3, max: -1 },
  { label: '-1% to 0%', min: -1, max: 0 },
  { label: '0% to 1%', min: 0, max: 1 },
  { label: '1% to 3%', min: 1, max: 3 },
  { label: '> 3%', min: 3, max: Infinity },
]

export interface ReturnProfile {
  observations: number
  annualisedReturnPercent: number
  annualisedVolatilityPercent: number
  winRatePercent: number
  maxDrawdownPercent: number
  skewness: number
  kurtosis: number
  histogram: { bucket: string; count: number }[]
  autocorrelation: { lag: number; value: number }[]
}

/** Full return profile: risk, distribution shape, histogram and autocorrelation. */
export function returnProfile(prices: PricePoint[]): ReturnProfile {
  const returns = returnsFrom(prices)
  const observations = returns.length
  const wins = returns.filter((value) => value > 0).length
  const histogram = HISTOGRAM_BUCKETS.map((bucket) => ({
    bucket: bucket.label,
    count: returns.filter((value) => value * 100 >= bucket.min && value * 100 < bucket.max).length,
  }))
  const acf = [1, 2, 3, 4, 5].map((lag) => ({ lag, value: round(autocorrelation(returns, lag), 3) }))
  return {
    observations,
    annualisedReturnPercent: round(mean(returns) * TRADING_DAYS_PER_YEAR * 100),
    annualisedVolatilityPercent: round(stdDev(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100),
    winRatePercent: observations > 0 ? round((wins / observations) * 100) : 0,
    maxDrawdownPercent: maxDrawdownPercent(prices),
    skewness: round(skewness(returns), 3),
    kurtosis: round(kurtosis(returns), 3),
    histogram,
    autocorrelation: acf,
  }
}

const RELATIVE_WINDOWS: { label: string; days: number }[] = [
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: '12M', days: 252 },
]

/** Relative performance versus a benchmark over 1M/3M/6M/12M windows. */
export function relativePerformance(
  prices: PricePoint[],
  benchmark: PricePoint[],
): { periods: { label: string; securityPercent: number; benchmarkPercent: number; excessPercent: number }[] } {
  const limit = Math.min(prices.length, benchmark.length)
  const periods = RELATIVE_WINDOWS.filter((window) => window.days < limit).map((window) => {
    const securityPercent = changeOver(prices, window.days)
    const benchmarkPercent = changeOver(benchmark, window.days)
    return {
      label: window.label,
      securityPercent,
      benchmarkPercent,
      excessPercent: round(securityPercent - benchmarkPercent),
    }
  })
  return { periods }
}

function changeOver(prices: PricePoint[], days: number): number {
  const last = prices[prices.length - 1].close
  const past = prices[prices.length - 1 - days].close
  return round(((last - past) / past) * 100)
}

export interface EventStudyRow {
  offset: number
  meanPercent: number
  medianPercent: number
  winRatePercent: number
  observations: number
}

/**
 * Event study of returns around a set of event dates, from `T-window` to
 * `T+window`. `note` warns when fewer than ten events matched.
 */
export function eventStudy(
  prices: PricePoint[],
  eventDates: string[],
  window = 5,
): { rows: EventStudyRow[]; observations: number; note: string } {
  const indexByDate = new Map(prices.map((point, index) => [point.date, index]))
  const anchors = eventDates
    .map((date) => indexByDate.get(date))
    .filter((index): index is number => index !== undefined)

  const rows: EventStudyRow[] = []
  for (let offset = -window; offset <= window; offset += 1) {
    const samples: number[] = []
    for (const anchor of anchors) {
      const target = anchor + offset
      if (target >= 1 && target < prices.length) {
        samples.push((prices[target].close - prices[target - 1].close) / prices[target - 1].close)
      }
    }
    const wins = samples.filter((value) => value > 0).length
    rows.push({
      offset,
      meanPercent: round(mean(samples) * 100, 3),
      medianPercent: round(median(samples) * 100, 3),
      winRatePercent: samples.length > 0 ? round((wins / samples.length) * 100) : 0,
      observations: samples.length,
    })
  }

  const observations = anchors.length
  const note =
    observations < 10
      ? `Only ${observations} event(s) matched — fewer than 10, interpret with caution.`
      : `${observations} events matched.`
  return { rows, observations, note }
}

/**
 * Ownership and positioning signals from the dataset. Metrics with no data
 * return `value: null` and an explicit note rather than a fabricated figure.
 */
export function ownershipSignals(
  ticker: string,
): { label: string; value: number | null; unit: string; note: string }[] {
  const company = getCompany(ticker)
  if (!company) {
    return [
      { label: 'Insider net activity', value: null, unit: 'shares', note: 'Unknown ticker.' },
      { label: 'Institutional ownership', value: null, unit: '%', note: 'Unknown ticker.' },
      { label: 'Short interest', value: null, unit: '%', note: 'Unknown ticker.' },
      { label: 'Options-implied move', value: null, unit: '%', note: 'Unknown ticker.' },
    ]
  }

  const netShares = company.insiders.reduce(
    (sum, transaction) => sum + (transaction.type === 'buy' ? transaction.shares : -transaction.shares),
    0,
  )
  const insider = {
    label: 'Insider net activity',
    value: netShares,
    unit: 'shares',
    note: `${company.insiders.length} filings.`,
  }

  const options = company.options
  const impliedMove =
    options !== null
      ? {
          label: 'Options-implied move',
          value: round(((options.atmCall + options.atmPut) / options.underlyingPrice) * 100),
          unit: '%',
          note: `From ${options.expiry} at-the-money straddle.`,
        }
      : { label: 'Options-implied move', value: null, unit: '%', note: 'No listed options in dataset.' }

  return [
    insider,
    {
      label: 'Institutional ownership',
      value: company.ownership.institutionalPercent,
      unit: '%',
      note: 'Reported institutional holdings.',
    },
    {
      label: 'Short interest',
      value: company.ownership.shortInterestPercent,
      unit: '%',
      note: 'Percent of float sold short.',
    },
    impliedMove,
  ]
}
