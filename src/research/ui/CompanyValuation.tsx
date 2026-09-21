import { useMemo, useState } from 'react'
import {
  assumptionsFromCompany,
  scenarios as buildScenarios,
  sensitivityMatrix,
  valueDcf,
  type DcfAssumptions,
} from '../dcf'
import { formatNumber, formatPercent } from '../format'
import { DataTable, Disclaimer, MetricGrid, Panel } from './primitives'
import type { CompanyRecord } from '../types'

type NumericKey =
  | 'revenue'
  | 'operatingMargin'
  | 'taxRate'
  | 'depreciationPercentOfRevenue'
  | 'capexPercentOfRevenue'
  | 'workingCapitalPercentOfRevenue'
  | 'wacc'
  | 'terminalGrowth'
  | 'exitMultiple'
  | 'netDebt'
  | 'dilutedShares'

const FIELDS: { key: NumericKey; label: string; step: number }[] = [
  { key: 'revenue', label: 'Revenue (m)', step: 100 },
  { key: 'operatingMargin', label: 'Operating margin', step: 0.01 },
  { key: 'taxRate', label: 'Tax rate', step: 0.01 },
  { key: 'depreciationPercentOfRevenue', label: 'D&A % of revenue', step: 0.005 },
  { key: 'capexPercentOfRevenue', label: 'CapEx % of revenue', step: 0.005 },
  { key: 'workingCapitalPercentOfRevenue', label: 'Working capital % of revenue', step: 0.005 },
  { key: 'wacc', label: 'WACC', step: 0.005 },
  { key: 'terminalGrowth', label: 'Terminal growth', step: 0.005 },
  { key: 'exitMultiple', label: 'Exit multiple', step: 0.5 },
  { key: 'netDebt', label: 'Net debt (m)', step: 100 },
  { key: 'dilutedShares', label: 'Diluted shares (m)', step: 10 },
]

export function CompanyValuation({
  company,
  onSaveReport,
}: {
  company: CompanyRecord
  onSaveReport: (assumptions: Record<string, number | string | null>, snapshot: Record<string, number | string | null>) => void
}) {
  const [assumptions, setAssumptions] = useState<DcfAssumptions>(() => assumptionsFromCompany(company))
  const [method, setMethod] = useState<'perpetuity' | 'exit-multiple'>('perpetuity')
  const [saved, setSaved] = useState(false)

  const result = useMemo(() => valueDcf(assumptions, method), [assumptions, method])
  const scenarioResults = useMemo(() => buildScenarios(assumptions, method), [assumptions, method])
  const growthMatrix = useMemo(() => sensitivityMatrix(assumptions, 'terminalGrowth'), [assumptions])
  const multipleMatrix = useMemo(() => sensitivityMatrix(assumptions, 'exitMultiple'), [assumptions])
  const currency = company.security.currency

  function update(key: NumericKey, raw: string) {
    setAssumptions((current) => ({ ...current, [key]: Number(raw) }))
    setSaved(false)
  }

  return (
    <div className="stack">
      <Panel title="Assumptions" subtitle="Every input is editable; results recalculate deterministically">
        <div className="filters">
          {FIELDS.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                type="number"
                step={field.step}
                value={assumptions[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
              />
            </label>
          ))}
          <label>
            Terminal value method
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as 'perpetuity' | 'exit-multiple')}
            >
              <option value="perpetuity">Perpetuity growth</option>
              <option value="exit-multiple">Exit multiple</option>
            </select>
          </label>
        </div>
        <div className="filters__row">
          {assumptions.revenueGrowth.map((growth, index) => (
            <label key={`growth-${index + 1}`}>
              {`Year ${index + 1} revenue growth`}
              <input
                type="number"
                step={0.01}
                value={growth}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  setAssumptions((current) => ({
                    ...current,
                    revenueGrowth: current.revenueGrowth.map((entry, position) =>
                      position === index ? value : entry,
                    ),
                  }))
                  setSaved(false)
                }}
              />
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Five-year unlevered free cash flow">
        <DataTable
          caption="Free cash flow forecast"
          columns={[
            'Year',
            'Revenue',
            'EBIT',
            'Taxes',
            'NOPAT',
            'D&A',
            'CapEx',
            'Working capital',
            'Unlevered FCF',
            'Discount factor',
            'Present value',
          ]}
          rows={result.years.map((year) => ({
            key: String(year.year),
            cells: [
              year.year,
              formatNumber(year.revenue, 0),
              formatNumber(year.ebit, 0),
              formatNumber(year.taxes, 0),
              formatNumber(year.nopat, 0),
              formatNumber(year.depreciation, 0),
              formatNumber(year.capex, 0),
              formatNumber(year.workingCapitalChange, 0),
              formatNumber(year.freeCashFlow, 0),
              formatNumber(year.discountFactor, 3),
              formatNumber(year.presentValue, 0),
            ],
          }))}
        />
      </Panel>

      <Panel title="Valuation output" subtitle={`Terminal value method: ${method}`}>
        <MetricGrid
          items={[
            { label: 'PV of forecast', value: formatNumber(result.pvOfForecast, 0) },
            { label: 'Terminal value', value: formatNumber(result.terminalValue, 0) },
            { label: 'PV of terminal value', value: formatNumber(result.pvOfTerminalValue, 0) },
            { label: 'Enterprise value', value: formatNumber(result.enterpriseValue, 0) },
            { label: 'Equity value', value: formatNumber(result.equityValue, 0) },
            { label: 'Implied value per share', value: formatNumber(result.valuePerShare) },
            { label: `Current price (${currency})`, value: formatNumber(result.currentPrice) },
            { label: 'Implied upside', value: formatPercent(result.upsidePercent) },
          ]}
        />
        {result.valuePerShare === null ? (
          <p className="missing__title">
            Terminal value is undefined because WACC is not above the terminal growth rate. Adjust the assumptions.
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            onSaveReport(
              {
                wacc: assumptions.wacc,
                terminalGrowth: assumptions.terminalGrowth,
                exitMultiple: assumptions.exitMultiple,
                operatingMargin: assumptions.operatingMargin,
                method,
              },
              {
                enterpriseValue: result.enterpriseValue,
                equityValue: result.equityValue,
                valuePerShare: result.valuePerShare,
                currentPrice: result.currentPrice,
                upsidePercent: result.upsidePercent,
              },
            )
            setSaved(true)
          }}
        >
          Save DCF as report
        </button>
        {saved ? (
          <p className="status" role="status">
            DCF report saved with a frozen snapshot of these assumptions.
          </p>
        ) : null}
      </Panel>

      <Panel title="Scenarios">
        <DataTable
          caption="Bear, base and bull DCF scenarios"
          columns={['Scenario', 'Value per share', 'Upside']}
          rows={scenarioResults.map((scenario) => ({
            key: scenario.name,
            cells: [
              scenario.name,
              formatNumber(scenario.result.valuePerShare),
              formatPercent(scenario.result.upsidePercent),
            ],
          }))}
        />
      </Panel>

      <Panel title="Sensitivity: WACC × terminal growth">
        <DataTable
          caption="WACC versus terminal growth"
          columns={['WACC', ...growthMatrix[0].cells.map((cell) => formatPercent(cell.axisValue * 100))]}
          rows={growthMatrix.map((row) => ({
            key: `g-${row.wacc}`,
            cells: [
              formatPercent(row.wacc * 100),
              ...row.cells.map((cell) => formatNumber(cell.valuePerShare)),
            ],
          }))}
        />
      </Panel>

      <Panel title="Sensitivity: WACC × exit multiple">
        <DataTable
          caption="WACC versus exit multiple"
          columns={['WACC', ...multipleMatrix[0].cells.map((cell) => `${formatNumber(cell.axisValue, 1)}x`)]}
          rows={multipleMatrix.map((row) => ({
            key: `m-${row.wacc}`,
            cells: [
              formatPercent(row.wacc * 100),
              ...row.cells.map((cell) => formatNumber(cell.valuePerShare)),
            ],
          }))}
        />
        <Disclaimer>
          A discounted cash flow model is an arithmetic consequence of its assumptions, not a forecast. Change the
          drivers to see how sensitive the implied value is.
        </Disclaimer>
      </Panel>
    </div>
  )
}
