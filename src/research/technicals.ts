import { roundTo } from '../lib/numbers'
import type { PricePoint } from './types'

/**
 * Deterministic technical-analysis engine.
 *
 * Every indicator returns an array the same length as its input, with leading
 * `null`s wherever there is not yet enough data to compute a value. Signal
 * wording is deliberately probabilistic — technical patterns describe
 * historical tendencies, never guaranteed outcomes.
 */

export type Timeframe = 'daily' | 'weekly' | 'monthly'

/** Buckets daily prices into weekly or monthly candles (last close, max high, min low, summed volume). */
export function resample(prices: PricePoint[], timeframe: Timeframe): PricePoint[] {
  if (timeframe === 'daily') return prices.map((point) => ({ ...point }))
  const keyOf =
    timeframe === 'weekly'
      ? (date: string) => Math.floor(Date.parse(date) / 86_400_000 / 7).toString()
      : (date: string) => date.slice(0, 7)
  const groups: PricePoint[][] = []
  const index = new Map<string, number>()
  for (const point of prices) {
    const key = keyOf(point.date)
    const at = index.get(key)
    if (at === undefined) {
      index.set(key, groups.length)
      groups.push([point])
    } else {
      groups[at].push(point)
    }
  }
  return groups.map((group) => {
    const last = group[group.length - 1]
    return {
      date: last.date,
      close: last.close,
      high: Math.max(...group.map((point) => point.high)),
      low: Math.min(...group.map((point) => point.low)),
      volume: group.reduce((sum, point) => sum + point.volume, 0),
    }
  })
}

/** Simple moving average. */
export function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null
    let sum = 0
    for (let j = i - period + 1; j <= i; j += 1) sum += values[j]
    return sum / period
  })
}

/** Exponential moving average, seeded with the simple average of the first window. */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let running = 0
  for (let i = 0; i < period; i += 1) running += values[i]
  running /= period
  out[period - 1] = running
  for (let i = period; i < values.length; i += 1) {
    running = values[i] * k + running * (1 - k)
    out[i] = running
  }
  return out
}

/** Wilder's relative strength index. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1]
    if (change >= 0) gain += change
    else loss -= change
  }
  gain /= period
  loss /= period
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1]
    const up = change > 0 ? change : 0
    const down = change < 0 ? -change : 0
    gain = (gain * (period - 1) + up) / period
    loss = (loss * (period - 1) + down) / period
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}

export interface MacdResult {
  macd: (number | null)[]
  signal: (number | null)[]
  histogram: (number | null)[]
}

/** Moving average convergence/divergence with its signal line and histogram. */
export function macd(values: number[], fast = 12, slow = 26, signal = 9): MacdResult {
  const emaFast = ema(values, fast)
  const emaSlow = ema(values, slow)
  const macdLine = values.map((_, i) => {
    const f = emaFast[i]
    const s = emaSlow[i]
    return f !== null && s !== null ? f - s : null
  })
  const signalLine: (number | null)[] = new Array(values.length).fill(null)
  const firstIndex = macdLine.findIndex((value) => value !== null)
  if (firstIndex !== -1) {
    const compact = macdLine.slice(firstIndex).filter((value): value is number => value !== null)
    const signalEma = ema(compact, signal)
    for (let i = 0; i < signalEma.length; i += 1) {
      const value = signalEma[i]
      if (value !== null) signalLine[firstIndex + i] = value
    }
  }
  const histogram = values.map((_, i) => {
    const m = macdLine[i]
    const s = signalLine[i]
    return m !== null && s !== null ? m - s : null
  })
  return { macd: macdLine, signal: signalLine, histogram }
}

export interface BollingerBands {
  upper: (number | null)[]
  middle: (number | null)[]
  lower: (number | null)[]
}

/** Bollinger bands: a simple moving average plus/minus a multiple of the population standard deviation. */
export function bollinger(values: number[], period = 20, multiple = 2): BollingerBands {
  const middle = sma(values, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < values.length; i += 1) {
    const mean = middle[i]
    if (mean === null) {
      upper.push(null)
      lower.push(null)
      continue
    }
    let variance = 0
    for (let j = i - period + 1; j <= i; j += 1) variance += (values[j] - mean) ** 2
    const sd = Math.sqrt(variance / period)
    upper.push(mean + multiple * sd)
    lower.push(mean - multiple * sd)
  }
  return { upper, middle, lower }
}

/** Average true range (Wilder smoothing). */
export function atr(prices: PricePoint[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(prices.length).fill(null)
  if (prices.length === 0) return out
  const trueRange: number[] = []
  for (let i = 0; i < prices.length; i += 1) {
    if (i === 0) {
      trueRange.push(prices[i].high - prices[i].low)
    } else {
      const prevClose = prices[i - 1].close
      trueRange.push(
        Math.max(
          prices[i].high - prices[i].low,
          Math.abs(prices[i].high - prevClose),
          Math.abs(prices[i].low - prevClose),
        ),
      )
    }
  }
  if (prices.length <= period) return out
  let running = 0
  for (let i = 1; i <= period; i += 1) running += trueRange[i]
  running /= period
  out[period] = running
  for (let i = period + 1; i < prices.length; i += 1) {
    running = (running * (period - 1) + trueRange[i]) / period
    out[i] = running
  }
  return out
}

/** Simple moving average of traded volume. */
export function volumeAverage(prices: PricePoint[], period = 20): (number | null)[] {
  return sma(
    prices.map((point) => point.volume),
    period,
  )
}

/**
 * Relative strength versus a benchmark over a lookback window: the ratio of the
 * asset's price performance to the benchmark's. Returns `null` when either
 * series is shorter than the lookback.
 */
export function relativeStrength(
  prices: PricePoint[],
  benchmark: PricePoint[],
  lookback = 63,
): number | null {
  if (prices.length <= lookback || benchmark.length <= lookback) return null
  const s0 = prices[prices.length - 1 - lookback].close
  const s1 = prices[prices.length - 1].close
  const b0 = benchmark[benchmark.length - 1 - lookback].close
  const b1 = benchmark[benchmark.length - 1].close
  return s1 / s0 / (b1 / b0) - 1
}

/** 52-week (252 trading day) low/high and where the last close sits within it. */
export function fiftyTwoWeekRange(prices: PricePoint[]): {
  low: number
  high: number
  percentOfRange: number
} {
  const window = prices.slice(-252)
  const low = Math.min(...window.map((point) => point.low))
  const high = Math.max(...window.map((point) => point.high))
  const last = prices[prices.length - 1].close
  const percentOfRange = high === low ? 0 : ((last - low) / (high - low)) * 100
  return { low, high, percentOfRange }
}

/** Standard Fibonacci retracement levels between a low and a high. */
export function fibonacciLevels(low: number, high: number): { label: string; value: number }[] {
  const ratios: [string, number][] = [
    ['0%', 0],
    ['23.6%', 0.236],
    ['38.2%', 0.382],
    ['50%', 0.5],
    ['61.8%', 0.618],
    ['78.6%', 0.786],
    ['100%', 1],
  ]
  const span = high - low
  return ratios.map(([label, ratio]) => ({ label, value: roundTo(high - span * ratio, 2) }))
}

/** Swing-pivot support (local lows) and resistance (local highs). */
export function supportResistance(
  prices: PricePoint[],
  lookback = 5,
): { support: number[]; resistance: number[] } {
  const support: number[] = []
  const resistance: number[] = []
  for (let i = lookback; i < prices.length - lookback; i += 1) {
    let isHigh = true
    let isLow = true
    for (let j = i - lookback; j <= i + lookback; j += 1) {
      if (j === i) continue
      if (prices[j].high >= prices[i].high) isHigh = false
      if (prices[j].low <= prices[i].low) isLow = false
    }
    if (isHigh) resistance.push(prices[i].high)
    if (isLow) support.push(prices[i].low)
  }
  return { support, resistance }
}

export interface TechnicalSignal {
  label: string
  stance: 'bullish' | 'bearish' | 'neutral'
  confidence: 'low' | 'medium' | 'high'
  detail: string
}

/**
 * Distils the indicator suite into human-readable signals. Wording is
 * probabilistic ("suggests", "historically associated with") because technical
 * patterns describe tendencies, not certainties.
 */
export function signals(prices: PricePoint[], benchmark?: PricePoint[]): TechnicalSignal[] {
  const out: TechnicalSignal[] = []
  const closes = prices.map((point) => point.close)
  const last = prices.length - 1

  const shortMa = sma(closes, 50)
  const longMa = sma(closes, 200)
  const shortNow = shortMa[last]
  const longNow = longMa[last]
  if (shortNow !== null && longNow !== null) {
    const nowAbove = shortNow > longNow
    const prior = Math.max(0, last - 20)
    const priorShort = shortMa[prior]
    const priorLong = longMa[prior]
    const priorAbove = priorShort !== null && priorLong !== null ? priorShort > priorLong : nowAbove
    if (nowAbove !== priorAbove) {
      out.push(
        nowAbove
          ? {
              label: 'Golden cross',
              stance: 'bullish',
              confidence: 'high',
              detail:
                'The 50-day average has crossed above the 200-day average, a pattern historically associated with improving momentum.',
            }
          : {
              label: 'Death cross',
              stance: 'bearish',
              confidence: 'high',
              detail:
                'The 50-day average has crossed below the 200-day average, a pattern historically associated with weakening momentum.',
            },
      )
    } else {
      out.push(
        nowAbove
          ? {
              label: 'Above 200-day average',
              stance: 'bullish',
              confidence: 'medium',
              detail: 'Price sits above its 200-day average, which suggests a constructive longer-term trend.',
            }
          : {
              label: 'Below 200-day average',
              stance: 'bearish',
              confidence: 'medium',
              detail: 'Price sits below its 200-day average, which suggests a fragile longer-term trend.',
            },
      )
    }
  }

  const rsiValues = rsi(closes)
  const rsiNow = rsiValues[last]
  if (rsiNow !== null) {
    if (rsiNow >= 70) {
      out.push({
        label: 'Overbought (RSI)',
        stance: 'bearish',
        confidence: 'medium',
        detail: `RSI near ${roundTo(rsiNow, 1)} suggests the advance may be extended and prone to a pause.`,
      })
    } else if (rsiNow <= 30) {
      out.push({
        label: 'Oversold (RSI)',
        stance: 'bullish',
        confidence: 'medium',
        detail: `RSI near ${roundTo(rsiNow, 1)} suggests selling may be stretched and prone to a bounce.`,
      })
    } else {
      out.push({
        label: 'Neutral RSI',
        stance: 'neutral',
        confidence: 'low',
        detail: `RSI near ${roundTo(rsiNow, 1)} suggests balanced momentum.`,
      })
    }
  }

  const macdResult = macd(closes)
  const macdNow = macdResult.macd[last]
  const signalNow = macdResult.signal[last]
  const macdPrior = Math.max(0, last - 5)
  const macdThen = macdResult.macd[macdPrior]
  const signalThen = macdResult.signal[macdPrior]
  if (macdNow !== null && signalNow !== null && macdThen !== null && signalThen !== null) {
    const nowUp = macdNow > signalNow
    const thenUp = macdThen > signalThen
    if (nowUp !== thenUp) {
      out.push(
        nowUp
          ? {
              label: 'MACD bullish cross',
              stance: 'bullish',
              confidence: 'medium',
              detail: 'MACD has crossed above its signal line, which historically suggests strengthening momentum.',
            }
          : {
              label: 'MACD bearish cross',
              stance: 'bearish',
              confidence: 'medium',
              detail: 'MACD has crossed below its signal line, which historically suggests fading momentum.',
            },
      )
    } else {
      out.push(
        nowUp
          ? {
              label: 'MACD above signal',
              stance: 'bullish',
              confidence: 'low',
              detail: 'MACD remains above its signal line, which suggests momentum is still positive.',
            }
          : {
              label: 'MACD below signal',
              stance: 'bearish',
              confidence: 'low',
              detail: 'MACD remains below its signal line, which suggests momentum is still negative.',
            },
      )
    }
  }

  const bands = bollinger(closes)
  const upperNow = bands.upper[last]
  const lowerNow = bands.lower[last]
  if (upperNow !== null && lowerNow !== null) {
    const price = closes[last]
    if (price > upperNow) {
      out.push({
        label: 'Bollinger breakout',
        stance: 'bullish',
        confidence: 'medium',
        detail: 'Price has pushed above the upper Bollinger band, which historically suggests strong momentum.',
      })
    } else if (price < lowerNow) {
      out.push({
        label: 'Bollinger breakdown',
        stance: 'bearish',
        confidence: 'medium',
        detail: 'Price has slipped below the lower Bollinger band, which historically suggests strong selling.',
      })
    } else {
      out.push({
        label: 'Inside Bollinger bands',
        stance: 'neutral',
        confidence: 'low',
        detail: 'Price is trading within its Bollinger bands, which suggests contained volatility.',
      })
    }
  }

  const volAvg = volumeAverage(prices)
  const volNow = volAvg[last]
  if (volNow !== null) {
    const volume = prices[last].volume
    if (volume > volNow * 1.5) {
      out.push({
        label: 'Volume surge',
        stance: 'neutral',
        confidence: 'high',
        detail: 'Volume is well above its recent average, which suggests conviction behind the current move.',
      })
    } else {
      out.push({
        label: 'Average volume',
        stance: 'neutral',
        confidence: 'low',
        detail: 'Volume is near its recent average, which suggests unremarkable participation.',
      })
    }
  }

  const range = fiftyTwoWeekRange(prices)
  if (range.percentOfRange >= 95) {
    out.push({
      label: '52-week breakout',
      stance: 'bullish',
      confidence: 'medium',
      detail: 'Price is near its 52-week high, a level historically associated with continuation.',
    })
  } else if (range.percentOfRange <= 5) {
    out.push({
      label: '52-week breakdown',
      stance: 'bearish',
      confidence: 'medium',
      detail: 'Price is near its 52-week low, a level historically associated with further weakness.',
    })
  } else {
    out.push({
      label: 'Mid 52-week range',
      stance: 'neutral',
      confidence: 'low',
      detail: 'Price sits within its 52-week range, which suggests no decisive breakout.',
    })
  }

  if (benchmark) {
    const rs = relativeStrength(prices, benchmark)
    if (rs !== null) {
      if (rs > 0) {
        out.push({
          label: 'Outperforming benchmark',
          stance: 'bullish',
          confidence: 'medium',
          detail: 'The asset has outpaced its benchmark recently, which suggests relative strength.',
        })
      } else if (rs < 0) {
        out.push({
          label: 'Underperforming benchmark',
          stance: 'bearish',
          confidence: 'medium',
          detail: 'The asset has lagged its benchmark recently, which suggests relative weakness.',
        })
      } else {
        out.push({
          label: 'In line with benchmark',
          stance: 'neutral',
          confidence: 'low',
          detail: 'The asset has tracked its benchmark recently, which suggests no relative edge.',
        })
      }
    }
  }

  return out
}

export interface TradePlan {
  entry: number
  stop: number
  target: number
  riskPerShare: number
  rewardPerShare: number
  riskReward: number | null
  positionSize: number | null
}

/**
 * Builds a risk-managed trade plan. Risk/reward is `null` when the stop equals
 * the entry (no definable risk), and position size is `null` when account size
 * or risk budget are not supplied.
 */
export function tradePlan(input: {
  entry: number
  stop: number
  target: number
  accountSize?: number
  riskPercent?: number
}): TradePlan {
  const { entry, stop, target, accountSize, riskPercent } = input
  const riskPerShare = roundTo(Math.abs(entry - stop), 2)
  const rewardPerShare = roundTo(Math.abs(target - entry), 2)
  const riskReward = riskPerShare === 0 ? null : roundTo(rewardPerShare / riskPerShare, 2)
  const positionSize =
    accountSize === undefined || riskPercent === undefined || riskPerShare === 0
      ? null
      : Math.floor((accountSize * (riskPercent / 100)) / riskPerShare)
  return { entry, stop, target, riskPerShare, rewardPerShare, riskReward, positionSize }
}
