import { useState } from 'react'
import {
  MACRO_CALENDAR,
  MACRO_SCENARIOS,
  MACRO_SERIES,
  changeOver,
  exposureMap,
  latestValue,
  scenarioImpact,
  yieldCurveSpread,
} from '../macro'
import { buildHoldings } from '../risk'
import { formatNumber, formatPercent, NOT_AVAILABLE } from '../format'
import { DataTable, Disclaimer, LineChart, MetricGrid, Panel, ProvenanceNote } from './primitives'
import type { Portfolio } from '../types'

export function MacroView({ portfolio }: { portfolio: Portfolio }) {
  const [scenarioId, setScenarioId] = useState(MACRO_SCENARIOS[0].id)
  const holdings = buildHoldings(portfolio.positions)
  const exposureHoldings = holdings.map((holding) => ({
    ticker: holding.ticker,
    sector: holding.sector,
    weight: holding.weight * 100,
  }))
  const estimate = scenarioImpact(exposureHoldings, scenarioId)
  const exposure = exposureMap(exposureHoldings)

  return (
    <div className="stack">
      <Panel title="Observed economic data" subtitle="Reported series from the connected macro provider">
        <MetricGrid
          items={[
            ...MACRO_SERIES.map((series) => ({
              label: series.label,
              value: `${formatNumber(latestValue(series))} ${series.unit}`,
              hint: `12-month change: ${
                changeOver(series, 12) === null ? NOT_AVAILABLE : formatNumber(changeOver(series, 12))
              }`,
            })),
            {
              label: '10y minus 2y spread',
              value: formatPercent(yieldCurveSpread(), 2),
            },
          ]}
        />
        <div className="macro-charts">
          {MACRO_SERIES.map((series) => (
            <div key={series.id} className="macro-charts__item">
              <h4>{series.label}</h4>
              <LineChart
                series={series.points.map((point) => point.value)}
                label={series.label}
                positive={(changeOver(series, 12) ?? 0) >= 0}
                height={60}
              />
            </div>
          ))}
        </div>
        <ProvenanceNote sources={[MACRO_SERIES[0].provenance]} />
      </Panel>

      <Panel title="Macro calendar">
        <DataTable
          caption="Upcoming macro releases"
          columns={['Date', 'Release', 'Importance']}
          rows={MACRO_CALENDAR.map((event) => ({
            key: `${event.date}-${event.label}`,
            cells: [
              event.date,
              event.label,
              <span key="importance" className={`pill is-${event.importance}`}>
                {event.importance}
              </span>,
            ],
          }))}
        />
      </Panel>

      <Panel title="Macro to portfolio exposure map">
        <DataTable
          caption="Macro factors mapped to holdings"
          columns={['Macro factor', 'Affected holdings', 'Mechanism', 'Portfolio sensitivity']}
          rows={exposure.map((row) => ({
            key: row.factor,
            cells: [
              row.label,
              row.holdings.map((holding) => `${holding.ticker} (${holding.sensitivity})`).join(', '),
              row.mechanism,
              formatNumber(row.sensitivity, 2),
            ],
          }))}
        />
      </Panel>

      <Panel title="Scenario analysis" subtitle="Generated from the sector sensitivities above">
        <label>
          Scenario
          <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
            {MACRO_SCENARIOS.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.label}
              </option>
            ))}
          </select>
        </label>
        {estimate === null ? (
          <p className="empty">{NOT_AVAILABLE}</p>
        ) : (
          <>
            <p>{estimate.description}</p>
            <MetricGrid
              items={[
                {
                  label: 'Estimated portfolio impact',
                  value: formatPercent(estimate.estimatedImpactPercent),
                },
              ]}
            />
            <DataTable
              caption="Estimated impact by holding"
              columns={['Ticker', 'Estimated impact']}
              rows={estimate.holdings.map((holding) => ({
                key: holding.ticker,
                cells: [holding.ticker, formatPercent(holding.estimatedImpactPercent)],
              }))}
            />
            <Disclaimer>{estimate.disclaimer}</Disclaimer>
          </>
        )}
      </Panel>
    </div>
  )
}
