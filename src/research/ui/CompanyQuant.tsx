import { useMemo, useState } from 'react'
import {
  dayOfWeekSeasonality,
  eventStudy,
  monthlySeasonality,
  ownershipSignals,
  relativePerformance,
  returnProfile,
} from '../quant'
import { MACRO_CALENDAR } from '../macro'
import { MARKET_INDEX } from '../universe'
import { formatNumber, formatPercent, NOT_AVAILABLE } from '../format'
import { DataTable, Disclaimer, MetricGrid, Panel } from './primitives'
import type { CompanyRecord, PricePoint } from '../types'

const PERIODS = [
  { label: '1 year', days: 252 },
  { label: '2 years', days: 504 },
]

function statRows(stats: ReturnType<typeof monthlySeasonality>) {
  return stats.map((stat) => ({
    key: stat.period,
    cells: [
      stat.period,
      stat.observations,
      formatPercent(stat.meanPercent, 3),
      formatPercent(stat.medianPercent, 3),
      formatPercent(stat.winRatePercent, 1),
      stat.tStat === null ? NOT_AVAILABLE : formatNumber(stat.tStat, 3),
      stat.significant ? 'significant at 95%' : 'not statistically significant',
    ],
  }))
}

const STAT_COLUMNS = ['Period', 'Observations', 'Mean', 'Median', 'Win rate', 't-stat', 'Significance']

export function CompanyQuant({ company }: { company: CompanyRecord }) {
  const [days, setDays] = useState(504)
  const [eventType, setEventType] = useState<'earnings' | 'macro'>('earnings')

  const prices: PricePoint[] = useMemo(() => company.prices.slice(-days), [company, days])
  const profile = returnProfile(prices)
  const monthly = monthlySeasonality(prices)
  const weekday = dayOfWeekSeasonality(prices)
  const relative = relativePerformance(prices, MARKET_INDEX.slice(-days))
  const eventDates =
    eventType === 'earnings'
      ? company.earnings.map((quarter) => quarter.reportDate)
      : MACRO_CALENDAR.map((event) => event.date)
  const study = eventStudy(prices, eventDates)
  const signals = ownershipSignals(company.security.ticker)

  return (
    <div className="stack">
      <Panel title="Return profile" subtitle={`${profile.observations} daily observations`}>
        <div className="filters__row">
          <label>
            Analysis period
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {PERIODS.map((period) => (
                <option key={period.days} value={period.days}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <MetricGrid
          items={[
            { label: 'Annualised return', value: formatPercent(profile.annualisedReturnPercent) },
            { label: 'Annualised volatility', value: formatPercent(profile.annualisedVolatilityPercent) },
            { label: 'Win rate', value: formatPercent(profile.winRatePercent) },
            { label: 'Max drawdown', value: formatPercent(profile.maxDrawdownPercent) },
            { label: 'Skewness', value: formatNumber(profile.skewness, 3) },
            { label: 'Kurtosis', value: formatNumber(profile.kurtosis, 3) },
          ]}
        />
        <DataTable
          caption="Daily return distribution"
          columns={['Bucket', 'Observations']}
          rows={profile.histogram.map((bucket) => ({ key: bucket.bucket, cells: [bucket.bucket, bucket.count] }))}
        />
        <DataTable
          caption="Autocorrelation of daily returns"
          columns={['Lag', 'Autocorrelation']}
          rows={profile.autocorrelation.map((entry) => ({
            key: String(entry.lag),
            cells: [entry.lag, formatNumber(entry.value, 3)],
          }))}
        />
      </Panel>

      <Panel title="Monthly seasonality">
        <DataTable caption="Monthly seasonality" columns={STAT_COLUMNS} rows={statRows(monthly)} />
      </Panel>

      <Panel title="Day-of-week seasonality">
        <DataTable caption="Day of week seasonality" columns={STAT_COLUMNS} rows={statRows(weekday)} />
      </Panel>

      <Panel title="Relative performance">
        <DataTable
          caption="Performance versus the market index"
          columns={['Window', 'Security', 'Benchmark', 'Excess']}
          rows={relative.periods.map((period) => ({
            key: period.label,
            cells: [
              period.label,
              formatPercent(period.securityPercent),
              formatPercent(period.benchmarkPercent),
              formatPercent(period.excessPercent),
            ],
          }))}
        />
      </Panel>

      <Panel title="Event study" subtitle={study.note}>
        <div className="filters__row">
          <label>
            Event set
            <select value={eventType} onChange={(event) => setEventType(event.target.value as 'earnings' | 'macro')}>
              <option value="earnings">Earnings reports</option>
              <option value="macro">Macro releases</option>
            </select>
          </label>
        </div>
        <DataTable
          caption="Returns around the event window"
          columns={['Offset', 'Mean', 'Median', 'Win rate', 'Observations']}
          rows={study.rows.map((row) => ({
            key: String(row.offset),
            cells: [
              `T${row.offset >= 0 ? '+' : ''}${row.offset}`,
              formatPercent(row.meanPercent, 3),
              formatPercent(row.medianPercent, 3),
              formatPercent(row.winRatePercent, 1),
              row.observations,
            ],
          }))}
        />
        <Disclaimer>
          Sample size and statistical significance are shown for every row so that random historical noise is not
          mistaken for a repeatable edge.
        </Disclaimer>
      </Panel>

      <Panel title="Positioning signals">
        <DataTable
          caption="Ownership, short interest and options positioning"
          columns={['Signal', 'Value', 'Unit', 'Note']}
          rows={signals.map((signal) => ({
            key: signal.label,
            cells: [
              signal.label,
              signal.value === null ? NOT_AVAILABLE : formatNumber(signal.value),
              signal.unit,
              signal.note,
            ],
          }))}
        />
      </Panel>
    </div>
  )
}
