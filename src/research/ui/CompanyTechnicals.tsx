import { useMemo, useState } from 'react'
import {
  atr,
  bollinger,
  ema,
  fiftyTwoWeekRange,
  fibonacciLevels,
  macd,
  relativeStrength,
  resample,
  rsi,
  signals,
  sma,
  supportResistance,
  tradePlan,
  volumeAverage,
  type Timeframe,
} from '../technicals'
import { MARKET_INDEX } from '../universe'
import { formatNumber, formatPercent } from '../format'
import { DataTable, Disclaimer, LineChart, MetricGrid, Panel } from './primitives'
import type { CompanyRecord } from '../types'

const INDICATORS = [
  { id: 'sma', label: 'Moving averages (20/50/100/200)' },
  { id: 'ema', label: 'EMA 21' },
  { id: 'rsi', label: 'RSI 14' },
  { id: 'macd', label: 'MACD' },
  { id: 'bollinger', label: 'Bollinger Bands' },
  { id: 'atr', label: 'ATR 14' },
  { id: 'volume', label: 'Volume average' },
  { id: 'fibonacci', label: 'Fibonacci retracement' },
]

function last(values: (number | null)[]): number | null {
  return values.length === 0 ? null : values[values.length - 1]
}

export function CompanyTechnicals({ company }: { company: CompanyRecord }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('daily')
  const [enabled, setEnabled] = useState<string[]>(['sma', 'rsi', 'macd'])
  const [plan, setPlan] = useState({ entry: 0, stop: 0, target: 0, accountSize: 100000, riskPercent: 1 })

  const prices = useMemo(() => resample(company.prices, timeframe), [company, timeframe])
  const closes = prices.map((point) => point.close)
  const range = fiftyTwoWeekRange(company.prices)
  const levels = supportResistance(prices)
  const macdResult = macd(closes)
  const bands = bollinger(closes)
  const detected = signals(prices, MARKET_INDEX)
  const fib = fibonacciLevels(range.low, range.high)
  const rs = relativeStrength(prices, resample(MARKET_INDEX, timeframe))
  const currentPlan = tradePlan(plan)

  function toggle(id: string) {
    setEnabled((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]))
  }

  return (
    <div className="stack">
      <Panel title="Price" subtitle={`${timeframe} series · ${prices.length} periods`}>
        <div className="filters__row">
          <label>
            Timeframe
            <select value={timeframe} onChange={(event) => setTimeframe(event.target.value as Timeframe)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {INDICATORS.map((indicator) => (
            <label key={indicator.id} className="checkbox">
              <input
                type="checkbox"
                checked={enabled.includes(indicator.id)}
                onChange={() => toggle(indicator.id)}
              />
              {indicator.label}
            </label>
          ))}
        </div>
        <LineChart series={closes} label={`${company.security.ticker} ${timeframe} close`} />
        <MetricGrid
          items={[
            { label: '52-week high', value: formatNumber(range.high) },
            { label: '52-week low', value: formatNumber(range.low) },
            { label: 'Position in range', value: formatPercent(range.percentOfRange) },
            { label: 'Relative strength vs index', value: formatPercent(rs === null ? null : rs * 100) },
          ]}
        />
      </Panel>

      {enabled.includes('sma') ? (
        <Panel title="Moving averages">
          <MetricGrid
            items={[20, 50, 100, 200].map((period) => ({
              label: `SMA ${period}`,
              value: formatNumber(last(sma(closes, period))),
            }))}
          />
        </Panel>
      ) : null}
      {enabled.includes('ema') ? (
        <Panel title="EMA 21">
          <MetricGrid items={[{ label: 'EMA 21', value: formatNumber(last(ema(closes, 21))) }]} />
        </Panel>
      ) : null}
      {enabled.includes('rsi') ? (
        <Panel title="RSI 14">
          <MetricGrid items={[{ label: 'RSI', value: formatNumber(last(rsi(closes))) }]} />
        </Panel>
      ) : null}
      {enabled.includes('macd') ? (
        <Panel title="MACD">
          <MetricGrid
            items={[
              { label: 'MACD', value: formatNumber(last(macdResult.macd)) },
              { label: 'Signal', value: formatNumber(last(macdResult.signal)) },
              { label: 'Histogram', value: formatNumber(last(macdResult.histogram)) },
            ]}
          />
        </Panel>
      ) : null}
      {enabled.includes('bollinger') ? (
        <Panel title="Bollinger Bands (20, 2σ)">
          <MetricGrid
            items={[
              { label: 'Upper', value: formatNumber(last(bands.upper)) },
              { label: 'Middle', value: formatNumber(last(bands.middle)) },
              { label: 'Lower', value: formatNumber(last(bands.lower)) },
            ]}
          />
        </Panel>
      ) : null}
      {enabled.includes('atr') ? (
        <Panel title="ATR 14">
          <MetricGrid items={[{ label: 'ATR', value: formatNumber(last(atr(prices))) }]} />
        </Panel>
      ) : null}
      {enabled.includes('volume') ? (
        <Panel title="Volume">
          <MetricGrid
            items={[
              { label: 'Latest volume', value: formatNumber(prices[prices.length - 1].volume, 0) },
              { label: '20-period average', value: formatNumber(last(volumeAverage(prices)), 0) },
            ]}
          />
        </Panel>
      ) : null}
      {enabled.includes('fibonacci') ? (
        <Panel title="Fibonacci retracement">
          <DataTable
            caption="Fibonacci retracement levels"
            columns={['Level', 'Price']}
            rows={fib.map((level) => ({ key: level.label, cells: [level.label, formatNumber(level.value)] }))}
          />
        </Panel>
      ) : null}

      <Panel title="Support and resistance">
        <MetricGrid
          items={[
            {
              label: 'Support levels',
              value: levels.support.length === 0 ? 'none detected' : levels.support.map((value) => formatNumber(value)).join(', '),
            },
            {
              label: 'Resistance levels',
              value:
                levels.resistance.length === 0
                  ? 'none detected'
                  : levels.resistance.map((value) => formatNumber(value)).join(', '),
            },
          ]}
        />
      </Panel>

      <Panel title="Detected signals">
        {detected.length === 0 ? (
          <p className="empty">No notable technical signals in this timeframe.</p>
        ) : (
          <DataTable
            caption="Technical signals"
            columns={['Signal', 'Stance', 'Confidence', 'Detail']}
            rows={detected.map((signal) => ({
              key: signal.label,
              cells: [signal.label, signal.stance, signal.confidence, signal.detail],
            }))}
          />
        )}
        <Disclaimer>
          Technical patterns describe historical tendencies with varying reliability. They are probabilistic context,
          not forecasts.
        </Disclaimer>
      </Panel>

      <Panel title="Trade planning" subtitle="Hypothetical levels you define">
        <div className="filters">
          {(['entry', 'stop', 'target', 'accountSize', 'riskPercent'] as const).map((field) => (
            <label key={field}>
              {field}
              <input
                type="number"
                value={plan[field]}
                onChange={(event) => setPlan((current) => ({ ...current, [field]: Number(event.target.value) }))}
              />
            </label>
          ))}
        </div>
        <MetricGrid
          items={[
            { label: 'Risk per share', value: formatNumber(currentPlan.riskPerShare) },
            { label: 'Reward per share', value: formatNumber(currentPlan.rewardPerShare) },
            { label: 'Risk/reward', value: formatNumber(currentPlan.riskReward) },
            {
              label: 'Position size',
              value: currentPlan.positionSize === null ? 'n/a' : formatNumber(currentPlan.positionSize, 0),
            },
          ]}
        />
      </Panel>
    </div>
  )
}
