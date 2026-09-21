import { describe, expect, it } from 'vitest'
import type { PricePoint } from './types'
import { MARKET_INDEX, UNIVERSE } from './universe'
import {
  dayOfWeekSeasonality,
  eventStudy,
  kurtosis,
  mean,
  median,
  monthlySeasonality,
  ownershipSignals,
  relativePerformance,
  returnProfile,
  skewness,
  stdDev,
  tStatistic,
} from './quant'

const PRICES = UNIVERSE[0].prices

function priceSeries(closes: number[], startDate = '2025-01-06'): PricePoint[] {
  const start = new Date(`${startDate}T00:00:00.000Z`)
  return closes.map((close, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return { date: date.toISOString().slice(0, 10), close, high: close, low: close, volume: 1000 }
  })
}

describe('stats helpers', () => {
  it('computes mean and handles empty input', () => {
    expect(mean([1, 2, 3])).toBe(2)
    expect(mean([])).toBe(0)
  })

  it('computes median for odd, even and empty input', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBe(0)
  })

  it('computes sample standard deviation', () => {
    expect(stdDev([1, 2, 3])).toBe(1)
    expect(stdDev([5])).toBe(0)
  })

  it('computes skewness with guards', () => {
    expect(skewness([1, 2, 3, 4, 5])).toBeCloseTo(0, 10)
    expect(skewness([1, 2])).toBe(0)
    expect(skewness([2, 2, 2])).toBe(0)
  })

  it('computes excess kurtosis with guards', () => {
    expect(kurtosis([1, 2, 3, 4, 5])).toBeCloseTo(-1.3, 10)
    expect(kurtosis([1, 2, 3])).toBe(0)
    expect(kurtosis([2, 2, 2, 2])).toBe(0)
  })

  it('computes a t-statistic with null guards', () => {
    expect(tStatistic([1, 2, 3])).toBeCloseTo(3.4641016, 6)
    expect(tStatistic([1, 2])).toBeNull()
    expect(tStatistic([2, 2, 2])).toBeNull()
  })
})

describe('monthlySeasonality', () => {
  it('returns twelve months and reports significance with sample size', () => {
    const months = monthlySeasonality(PRICES)
    expect(months).toHaveLength(12)
    expect(months.some((month) => month.significant)).toBe(true)
    expect(months.some((month) => !month.significant)).toBe(true)
    expect(months[0].observations).toBeGreaterThan(0)
  })

  it('reports null t-stats and zero win rate for sparse months', () => {
    const months = monthlySeasonality(priceSeries([100, 101]))
    const january = months[0]
    expect(january.observations).toBe(1)
    expect(january.tStat).toBeNull()
    expect(january.significant).toBe(false)
    const february = months[1]
    expect(february.observations).toBe(0)
    expect(february.winRatePercent).toBe(0)
  })
})

describe('dayOfWeekSeasonality', () => {
  it('returns Monday through Friday', () => {
    const days = dayOfWeekSeasonality(PRICES)
    expect(days.map((day) => day.period)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ])
    expect(days.some((day) => day.significant)).toBe(true)
  })

  it('handles weekdays with no observations', () => {
    const days = dayOfWeekSeasonality(priceSeries([100, 101]))
    const tuesday = days.find((day) => day.period === 'Tuesday')
    const monday = days.find((day) => day.period === 'Monday')
    expect(tuesday?.observations).toBe(1)
    expect(monday?.observations).toBe(0)
  })
})

describe('returnProfile', () => {
  it('profiles a full price history', () => {
    const profile = returnProfile(PRICES)
    expect(profile.observations).toBe(PRICES.length - 1)
    expect(profile.histogram).toHaveLength(6)
    expect(profile.autocorrelation.map((point) => point.lag)).toEqual([1, 2, 3, 4, 5])
    expect(profile.maxDrawdownPercent).toBeGreaterThan(0)
    const totalHistogram = profile.histogram.reduce((sum, bucket) => sum + bucket.count, 0)
    expect(totalHistogram).toBe(profile.observations)
  })

  it('handles an empty series', () => {
    const profile = returnProfile([])
    expect(profile.observations).toBe(0)
    expect(profile.winRatePercent).toBe(0)
    expect(profile.maxDrawdownPercent).toBe(0)
    expect(profile.annualisedReturnPercent).toBe(0)
  })

  it('handles a flat series with no dispersion', () => {
    const profile = returnProfile(priceSeries([50, 50, 50, 50, 50, 50]))
    expect(profile.annualisedVolatilityPercent).toBe(0)
    expect(profile.skewness).toBe(0)
    expect(profile.kurtosis).toBe(0)
    expect(profile.maxDrawdownPercent).toBe(0)
    expect(profile.autocorrelation[0].value).toBe(0)
    expect(profile.winRatePercent).toBe(0)
  })
})

describe('relativePerformance', () => {
  it('compares across 1M/3M/6M/12M windows', () => {
    const result = relativePerformance(PRICES, MARKET_INDEX)
    expect(result.periods.map((period) => period.label)).toEqual(['1M', '3M', '6M', '12M'])
    for (const period of result.periods) {
      expect(period.excessPercent).toBeCloseTo(period.securityPercent - period.benchmarkPercent, 5)
    }
  })

  it('skips windows longer than the available history', () => {
    const result = relativePerformance(PRICES.slice(0, 30), MARKET_INDEX.slice(0, 30))
    expect(result.periods.map((period) => period.label)).toEqual(['1M'])
  })
})

describe('eventStudy', () => {
  it('warns when too few events match and ignores unknown dates', () => {
    const study = eventStudy(PRICES, [PRICES[100].date, PRICES[200].date, '1999-01-01'])
    expect(study.observations).toBe(2)
    expect(study.note).toContain('fewer than 10')
    expect(study.rows).toHaveLength(11)
  })

  it('reports confidence with enough events', () => {
    const dates = PRICES.slice(20, 32).map((point) => point.date)
    const study = eventStudy(PRICES, dates, 3)
    expect(study.observations).toBe(12)
    expect(study.note).toBe('12 events matched.')
    expect(study.rows).toHaveLength(7)
  })

  it('skips offsets that fall outside the series at the boundary', () => {
    const study = eventStudy(PRICES, [PRICES[0].date], 3)
    expect(study.rows[0].observations).toBe(0)
    expect(study.rows[0].winRatePercent).toBe(0)
    expect(study.rows[study.rows.length - 1].observations).toBe(1)
  })
})

describe('ownershipSignals', () => {
  it('returns nulls with a note for an unknown ticker', () => {
    const signals = ownershipSignals('ZZZ')
    expect(signals).toHaveLength(4)
    expect(signals.every((signal) => signal.value === null)).toBe(true)
    expect(signals.every((signal) => signal.note === 'Unknown ticker.')).toBe(true)
  })

  it('surfaces insider, ownership, short and options signals from the dataset', () => {
    let sawOptions = false
    let sawMissingOptions = false
    let sawBuy = false
    let sawSell = false
    for (const company of UNIVERSE) {
      const signals = ownershipSignals(company.security.ticker)
      const options = signals.find((signal) => signal.label === 'Options-implied move')
      if (options?.value === null) sawMissingOptions = true
      else sawOptions = true
      const insider = signals.find((signal) => signal.label === 'Insider net activity')
      expect(insider?.unit).toBe('shares')
      const net = company.insiders.reduce(
        (sum, transaction) => sum + (transaction.type === 'buy' ? transaction.shares : -transaction.shares),
        0,
      )
      if (company.insiders.some((transaction) => transaction.type === 'buy')) sawBuy = true
      if (company.insiders.some((transaction) => transaction.type === 'sell')) sawSell = true
      expect(insider?.value).toBe(net)
      const institutional = signals.find((signal) => signal.label === 'Institutional ownership')
      expect(institutional?.value).toBe(company.ownership.institutionalPercent)
    }
    expect(sawOptions).toBe(true)
    expect(sawMissingOptions).toBe(true)
    expect(sawBuy).toBe(true)
    expect(sawSell).toBe(true)
  })
})
