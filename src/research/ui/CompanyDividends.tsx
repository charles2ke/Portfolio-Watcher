import { useState } from 'react'
import { dividendSafety, dividendSummary, dripScenarios, simulateDrip } from '../dividends'
import { formatNumber, formatPercent, NOT_AVAILABLE } from '../format'
import { DataTable, Disclaimer, MetricGrid, Panel } from './primitives'
import type { CompanyRecord } from '../types'

export function CompanyDividends({ company }: { company: CompanyRecord }) {
  const summary = dividendSummary(company.security.ticker)
  const [drip, setDrip] = useState({
    initialInvestment: 10_000,
    annualContribution: 2_400,
    dividendGrowth: 0.06,
    priceGrowth: 0.05,
    reinvest: true,
    years: 10,
  })

  if (!summary) {
    return (
      <Panel title="Dividends">
        <p className="empty">
          {company.security.ticker} does not pay a dividend in the connected data sources, so no yield, payout or
          growth history is shown.
        </p>
      </Panel>
    )
  }

  const safety = dividendSafety(summary)
  const dripInput = { ...drip, startingYieldPercent: summary.yieldPercent }
  const rows = simulateDrip(dripInput)
  const horizons = dripScenarios(dripInput)

  return (
    <div className="stack">
      <Panel title="Dividend profile">
        <MetricGrid
          items={[
            { label: 'Dividend yield', value: formatPercent(summary.yieldPercent) },
            { label: 'Annual dividend', value: formatNumber(summary.annualDividend) },
            { label: 'Payments per year', value: String(summary.paymentsPerYear) },
            { label: 'Ex-dividend date', value: summary.exDividendDate },
            { label: 'Payout ratio', value: formatPercent(summary.payoutRatio * 100) },
            { label: 'FCF payout ratio', value: formatPercent(summary.fcfPayoutRatio * 100) },
            { label: 'Consecutive growth years', value: String(summary.consecutiveGrowthYears) },
            {
              label: '3-year CAGR',
              value: summary.cagr3y === null ? NOT_AVAILABLE : formatPercent(summary.cagr3y * 100),
            },
            {
              label: '5-year CAGR',
              value: summary.cagr5y === null ? NOT_AVAILABLE : formatPercent(summary.cagr5y * 100),
            },
            {
              label: '10-year CAGR',
              value: summary.cagr10y === null ? NOT_AVAILABLE : formatPercent(summary.cagr10y * 100),
            },
            {
              label: 'Last dividend cut',
              value: summary.lastCutYear === null ? 'No recorded cut' : String(summary.lastCutYear),
            },
            { label: 'Net debt / EBITDA', value: formatNumber(summary.netDebtToEbitda) },
          ]}
        />
      </Panel>

      <Panel title={`Dividend safety: ${safety.band} (${safety.score}/100)`} subtitle="Every contributing factor is shown">
        <DataTable
          caption="Dividend safety factors"
          columns={['Factor', 'Value', 'Verdict', 'Weight', 'Why']}
          rows={safety.factors.map((factor) => ({
            key: factor.factor,
            cells: [
              factor.factor,
              formatNumber(factor.value),
              factor.verdict,
              formatPercent(factor.weight * 100, 0),
              factor.detail,
            ],
          }))}
        />
      </Panel>

      <Panel title="DRIP simulator" subtitle="Deterministic projection from your own assumptions">
        <div className="filters">
          <label>
            Initial investment
            <input
              type="number"
              value={drip.initialInvestment}
              onChange={(event) =>
                setDrip((current) => ({ ...current, initialInvestment: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Annual contribution
            <input
              type="number"
              value={drip.annualContribution}
              onChange={(event) =>
                setDrip((current) => ({ ...current, annualContribution: Number(event.target.value) }))
              }
            />
          </label>
          <label>
            Dividend growth
            <input
              type="number"
              step={0.01}
              value={drip.dividendGrowth}
              onChange={(event) => setDrip((current) => ({ ...current, dividendGrowth: Number(event.target.value) }))}
            />
          </label>
          <label>
            Price growth
            <input
              type="number"
              step={0.01}
              value={drip.priceGrowth}
              onChange={(event) => setDrip((current) => ({ ...current, priceGrowth: Number(event.target.value) }))}
            />
          </label>
          <label>
            Projection horizon (years)
            <input
              type="number"
              value={drip.years}
              onChange={(event) => setDrip((current) => ({ ...current, years: Number(event.target.value) }))}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={drip.reinvest}
              onChange={(event) => setDrip((current) => ({ ...current, reinvest: event.target.checked }))}
            />
            Reinvest dividends
          </label>
        </div>
        <DataTable
          caption="Year by year projection"
          columns={['Year', 'Starting value', 'Contributions', 'Dividend income', 'Reinvested', 'Ending value', 'Yield on cost']}
          rows={rows.map((row) => ({
            key: String(row.year),
            cells: [
              row.year,
              formatNumber(row.startingValue, 0),
              formatNumber(row.contributions, 0),
              formatNumber(row.dividendIncome, 0),
              formatNumber(row.reinvested, 0),
              formatNumber(row.endingValue, 0),
              formatPercent(row.yieldOnCost),
            ],
          }))}
        />
        <DataTable
          caption="5, 10 and 20 year scenarios"
          columns={['Horizon', 'Projected value', 'Projected annual income']}
          rows={horizons.map((scenario) => ({
            key: String(scenario.horizon),
            cells: [
              `${scenario.horizon} years`,
              formatNumber(scenario.finalValue, 0),
              formatNumber(scenario.annualIncome, 0),
            ],
          }))}
        />
        <Disclaimer>
          Projections compound the growth rates you entered. They illustrate arithmetic, not expected returns.
        </Disclaimer>
      </Panel>
    </div>
  )
}
