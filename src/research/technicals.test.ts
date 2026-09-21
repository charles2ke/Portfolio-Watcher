import { describe, expect, it } from 'vitest'
import type { PricePoint } from './types'
import {
  atr,
  bollinger,
  ema,
  fibonacciLevels,
  fiftyTwoWeekRange,
  macd,
  relativeStrength,
  resample,
  rsi,
  signals,
  sma,
  supportResistance,
  tradePlan,
  volumeAverage,
} from './technicals'

const DAY = 86_400_000
const BASE = Date.UTC(2020, 0, 1)

function dateAt(index: number): string {
  return new Date(BASE + index * DAY).toISOString().slice(0, 10)
}

interface PriceOptions {
  highs?: number[]
  lows?: number[]
  volumes?: number[]
}

function toPrices(closes: number[], options: PriceOptions = {}): PricePoint[] {
  return closes.map((close, index) => ({
    date: dateAt(index),
    close,
    high: options.highs ? options.highs[index] : close,
    low: options.lows ? options.lows[index] : close,
    volume: options.volumes ? options.volumes[index] : 1000,
  }))
}

function linear(length: number, start: number, step: number): number[] {
  return Array.from({ length }, (_, i) => start + step * i)
}

function vShape(bottom: number, length: number, top: number, floor: number): number[] {
  return Array.from({ length }, (_, i) =>
    i <= bottom
      ? top - (top - floor) * (i / bottom)
      : floor + (top - floor) * ((i - bottom) / (length - 1 - bottom)),
  )
}

function invertedV(top: number, length: number, high: number, low: number): number[] {
  return Array.from({ length }, (_, i) =>
    i <= top
      ? low + (high - low) * (i / top)
      : high - (high - low) * ((i - top) / (length - 1 - top)),
  )
}

describe('resample', () => {
  const prices: PricePoint[] = [
    { date: '2020-01-06', close: 10, high: 11, low: 9, volume: 100 },
    { date: '2020-01-07', close: 12, high: 13, low: 8, volume: 200 },
    { date: '2020-01-08', close: 11, high: 14, low: 10, volume: 150 },
    { date: '2020-01-13', close: 20, high: 21, low: 19, volume: 300 },
    { date: '2020-01-14', close: 22, high: 25, low: 18, volume: 400 },
    { date: '2020-02-03', close: 30, high: 31, low: 29, volume: 500 },
  ]

  it('returns copies for the daily timeframe', () => {
    const daily = resample(prices, 'daily')
    expect(daily).toEqual(prices)
    expect(daily[0]).not.toBe(prices[0])
  })

  it('aggregates weekly candles', () => {
    const weekly = resample(prices, 'weekly')
    expect(weekly).toHaveLength(3)
    expect(weekly[0]).toEqual({ date: '2020-01-08', close: 11, high: 14, low: 8, volume: 450 })
    expect(weekly[1]).toEqual({ date: '2020-01-14', close: 22, high: 25, low: 18, volume: 700 })
  })

  it('aggregates monthly candles', () => {
    const monthly = resample(prices, 'monthly')
    expect(monthly).toHaveLength(2)
    expect(monthly[0]).toEqual({ date: '2020-01-14', close: 22, high: 25, low: 8, volume: 1150 })
    expect(monthly[1]).toEqual({ date: '2020-02-03', close: 30, high: 31, low: 29, volume: 500 })
  })
})

describe('sma', () => {
  it('computes a trailing average with leading nulls', () => {
    expect(sma([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
  })
})

describe('ema', () => {
  it('seeds with the simple average then decays', () => {
    expect(ema([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4])
  })

  it('returns all nulls when shorter than the period', () => {
    expect(ema([1, 2], 3)).toEqual([null, null])
  })
})

describe('rsi', () => {
  it('returns all nulls when there is not enough data', () => {
    expect(rsi([1, 2], 2)).toEqual([null, null])
  })

  it('reports 100 for an uninterrupted advance', () => {
    expect(rsi([1, 2, 3, 4], 2)).toEqual([null, null, 100, 100])
  })

  it('reports 0 for an uninterrupted decline', () => {
    expect(rsi([4, 3, 2, 1], 2)).toEqual([null, null, 0, 0])
  })

  it('computes mixed gains and losses (hand-checked)', () => {
    expect(rsi([1, 2, 1, 2], 2)).toEqual([null, null, 50, 75])
  })

  it('uses a default period of 14', () => {
    const values = linear(20, 1, 1)
    expect(rsi(values)[19]).toBe(100)
  })
})

describe('macd', () => {
  it('computes the macd line, signal and histogram (hand-checked)', () => {
    expect(macd([1, 2, 3, 4], 2, 3, 2)).toEqual({
      macd: [null, null, 0.5, 0.5],
      signal: [null, null, null, 0.5],
      histogram: [null, null, null, 0],
    })
  })

  it('returns all nulls when there is no macd line', () => {
    expect(macd([1], 12, 26, 9)).toEqual({ macd: [null], signal: [null], histogram: [null] })
  })
})

describe('bollinger', () => {
  it('computes bands from the population standard deviation (hand-checked)', () => {
    expect(bollinger([2, 4, 6], 2, 2)).toEqual({
      upper: [null, 5, 7],
      middle: [null, 3, 5],
      lower: [null, 1, 3],
    })
  })
})

describe('atr', () => {
  const prices = toPrices([9, 11, 12, 13], {
    highs: [10, 12, 13, 14],
    lows: [8, 9, 11, 12],
  })

  it('returns an empty array for empty input', () => {
    expect(atr([])).toEqual([])
  })

  it('returns all nulls when shorter than the period', () => {
    expect(atr(prices.slice(0, 2), 2)).toEqual([null, null])
  })

  it('computes Wilder-smoothed true range (hand-checked)', () => {
    expect(atr(prices, 2)).toEqual([null, null, 2.5, 2.25])
  })
})

describe('volumeAverage', () => {
  it('averages traded volume', () => {
    const prices = toPrices([1, 2, 3], { volumes: [100, 200, 300] })
    expect(volumeAverage(prices, 2)).toEqual([null, 150, 250])
  })
})

describe('relativeStrength', () => {
  it('returns null when either series is too short', () => {
    const short = toPrices([100, 110])
    expect(relativeStrength(short, short, 2)).toBeNull()
  })

  it('measures performance relative to a benchmark', () => {
    const asset = toPrices([100, 110])
    const benchmark = toPrices([100, 105])
    expect(relativeStrength(asset, benchmark, 1)).toBeCloseTo(1.1 / 1.05 - 1, 10)
  })
})

describe('fiftyTwoWeekRange', () => {
  it('locates the last close within the range', () => {
    const prices = toPrices([50, 60], { highs: [55, 70], lows: [45, 55] })
    const range = fiftyTwoWeekRange(prices)
    expect(range.low).toBe(45)
    expect(range.high).toBe(70)
    expect(range.percentOfRange).toBeCloseTo(((60 - 45) / (70 - 45)) * 100, 10)
  })

  it('reports zero percent for a flat range', () => {
    const prices = toPrices([50, 50])
    expect(fiftyTwoWeekRange(prices).percentOfRange).toBe(0)
  })
})

describe('fibonacciLevels', () => {
  it('spaces retracement levels between low and high', () => {
    expect(fibonacciLevels(0, 100)).toEqual([
      { label: '0%', value: 100 },
      { label: '23.6%', value: 76.4 },
      { label: '38.2%', value: 61.8 },
      { label: '50%', value: 50 },
      { label: '61.8%', value: 38.2 },
      { label: '78.6%', value: 21.4 },
      { label: '100%', value: 0 },
    ])
  })
})

describe('supportResistance', () => {
  it('detects swing pivots', () => {
    const prices = toPrices([2, 5, 3, 6, 4], {
      highs: [2, 5, 3, 6, 4],
      lows: [1, 2, 0, 2, 1],
    })
    expect(supportResistance(prices, 1)).toEqual({ support: [0], resistance: [5, 6] })
  })

  it('uses a default lookback', () => {
    const prices = toPrices(linear(5, 1, 1))
    expect(supportResistance(prices)).toEqual({ support: [], resistance: [] })
  })
})

describe('signals', () => {
  const flatBenchmark = toPrices(Array.from({ length: 260 }, () => 100))

  function labels(list: ReturnType<typeof signals>): string[] {
    return list.map((signal) => signal.label)
  }

  it('reads a strong uptrend with a volume surge and outperformance', () => {
    const volumes = Array.from({ length: 260 }, (_, i) => (i === 259 ? 100_000 : 1000))
    const up = toPrices(linear(260, 100, 1), { volumes })
    const result = labels(signals(up, flatBenchmark))
    expect(result).toContain('Above 200-day average')
    expect(result).toContain('Overbought (RSI)')
    expect(result).toContain('Volume surge')
    expect(result).toContain('52-week breakout')
    expect(result).toContain('Outperforming benchmark')
  })

  it('reads a persistent downtrend as bearish and underperforming', () => {
    const down = toPrices(linear(260, 400, -1))
    const result = labels(signals(down, flatBenchmark))
    expect(result).toContain('Below 200-day average')
    expect(result).toContain('Oversold (RSI)')
    expect(result).toContain('Average volume')
    expect(result).toContain('52-week breakdown')
    expect(result).toContain('Underperforming benchmark')
  })

  it('recognises golden and death crosses', () => {
    const golden = toPrices(vShape(210, 260, 300, 100))
    const death = toPrices(invertedV(210, 260, 300, 100))
    expect(labels(signals(golden))).toContain('Golden cross')
    expect(labels(signals(death))).toContain('Death cross')
  })

  it('recognises macd crosses', () => {
    const up = toPrices(vShape(255, 260, 300, 100))
    const down = toPrices(invertedV(254, 260, 300, 100))
    expect(labels(signals(up))).toContain('MACD bullish cross')
    expect(labels(signals(down))).toContain('MACD bearish cross')
  })

  it('reports macd momentum without a cross', () => {
    const up = toPrices(linear(260, 100, 1))
    const down = toPrices(linear(260, 400, -1))
    const upLabels = labels(signals(up))
    const downLabels = labels(signals(down))
    expect(upLabels.includes('MACD above signal') || upLabels.includes('MACD below signal')).toBe(true)
    expect(downLabels.includes('MACD above signal') || downLabels.includes('MACD below signal')).toBe(
      true,
    )
  })

  it('handles the exactly-200-point trend window', () => {
    const up = toPrices(linear(200, 100, 1))
    expect(labels(signals(up))).toContain('Above 200-day average')
  })

  it('flags Bollinger breakouts and breakdowns', () => {
    const breakout = toPrices([...Array.from({ length: 29 }, () => 100), 200])
    const breakdown = toPrices([...Array.from({ length: 29 }, () => 100), 10])
    expect(labels(signals(breakout))).toContain('Bollinger breakout')
    expect(labels(signals(breakdown))).toContain('Bollinger breakdown')
  })

  it('reports neutral RSI and Bollinger readings', () => {
    const closes = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 100 : 101))
    const result = labels(signals(toPrices(closes)))
    expect(result).toContain('Neutral RSI')
    expect(result).toContain('Inside Bollinger bands')
  })

  it('reports a mid 52-week range and skips short-data signals', () => {
    const prices = toPrices([100, 100, 100, 100, 100], {
      highs: [100, 110, 100, 100, 100],
      lows: [100, 100, 100, 90, 100],
    })
    const result = signals(prices)
    expect(labels(result)).toEqual(['Mid 52-week range'])
  })

  it('reports in-line performance and handles a missing/short benchmark', () => {
    const up = toPrices(linear(260, 100, 1))
    expect(labels(signals(up, up))).toContain('In line with benchmark')
    const shortBenchmark = toPrices(linear(5, 100, 1))
    expect(labels(signals(up, shortBenchmark))).not.toContain('Outperforming benchmark')
    expect(labels(signals(up))).not.toContain('Outperforming benchmark')
  })
})

describe('tradePlan', () => {
  it('sizes a position from account risk', () => {
    expect(
      tradePlan({ entry: 100, stop: 90, target: 120, accountSize: 10_000, riskPercent: 2 }),
    ).toEqual({
      entry: 100,
      stop: 90,
      target: 120,
      riskPerShare: 10,
      rewardPerShare: 20,
      riskReward: 2,
      positionSize: 20,
    })
  })

  it('returns null risk/reward and size when risk is zero', () => {
    const plan = tradePlan({ entry: 100, stop: 100, target: 120, accountSize: 10_000, riskPercent: 2 })
    expect(plan.riskReward).toBeNull()
    expect(plan.positionSize).toBeNull()
  })

  it('returns null size when the account size is missing', () => {
    const plan = tradePlan({ entry: 100, stop: 90, target: 110, riskPercent: 2 })
    expect(plan.riskReward).toBe(1)
    expect(plan.positionSize).toBeNull()
  })

  it('returns null size when the risk budget is missing', () => {
    const plan = tradePlan({ entry: 100, stop: 90, target: 110, accountSize: 10_000 })
    expect(plan.positionSize).toBeNull()
  })
})
