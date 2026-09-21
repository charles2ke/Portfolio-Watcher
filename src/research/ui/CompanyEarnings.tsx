import { analyseEarnings } from '../earnings'
import { formatNumber, formatPercent, NOT_AVAILABLE } from '../format'
import { DataTable, Disclaimer, MetricGrid, Panel } from './primitives'
import type { CompanyRecord } from '../types'

export function CompanyEarnings({ company }: { company: CompanyRecord }) {
  const analysis = analyseEarnings(company.security.ticker)
  if (!analysis) return null

  return (
    <div className="stack">
      <Panel title="Earnings history" subtitle={`Next report ${analysis.nextEarningsDate}`}>
        <MetricGrid
          items={[
            { label: 'Average EPS surprise', value: formatPercent(analysis.averageEpsSurprisePercent) },
            { label: 'Beat rate', value: formatPercent(analysis.beatRatePercent) },
            {
              label: 'Average absolute reaction',
              value: formatPercent(analysis.averageAbsoluteReactionPercent),
            },
            {
              label: 'Market-implied move',
              value:
                analysis.impliedMovePercent === null
                  ? NOT_AVAILABLE
                  : formatPercent(analysis.impliedMovePercent),
              hint:
                analysis.impliedMovePercent === null
                  ? 'No reliable options data is connected for this security.'
                  : 'From the at-the-money straddle in the connected options snapshot.',
            },
          ]}
        />
        <DataTable
          caption="Last four reported quarters"
          columns={[
            'Period',
            'Reported EPS',
            'Consensus EPS',
            'EPS surprise',
            'Reported revenue',
            'Consensus revenue',
            'Revenue surprise',
            'Price reaction',
          ]}
          rows={analysis.quarters.map((quarter) => ({
            key: quarter.period,
            cells: [
              quarter.period,
              formatNumber(quarter.epsReported),
              formatNumber(quarter.epsConsensus),
              formatPercent(quarter.epsSurprisePercent),
              formatNumber(quarter.revenueReported, 0),
              formatNumber(quarter.revenueConsensus, 0),
              formatPercent(quarter.revenueSurprisePercent),
              formatPercent(quarter.priceReactionPercent),
            ],
          }))}
        />
      </Panel>

      <Panel title="Company KPIs">
        {analysis.kpis.length === 0 ? (
          <p className="empty">{NOT_AVAILABLE}</p>
        ) : (
          <DataTable
            caption="Company specific key performance indicators"
            columns={['KPI', 'Value', 'Unit', 'Period']}
            rows={analysis.kpis.map((kpi) => ({
              key: kpi.label,
              cells: [kpi.label, formatNumber(kpi.value), kpi.unit, kpi.period],
            }))}
          />
        )}
      </Panel>

      <Panel title="Guidance versus consensus">
        {analysis.guidance.length === 0 ? (
          <p className="empty">{NOT_AVAILABLE}</p>
        ) : (
          <DataTable
            caption="Management guidance compared with consensus"
            columns={['Metric', 'Guidance low', 'Guidance high', 'Midpoint', 'Consensus', 'Versus consensus', 'Verdict']}
            rows={analysis.guidance.map((item) => ({
              key: item.metric,
              cells: [
                item.metric,
                formatNumber(item.low),
                formatNumber(item.high),
                formatNumber(item.midpoint),
                item.consensus === null ? NOT_AVAILABLE : formatNumber(item.consensus),
                formatPercent(item.versusConsensusPercent),
                item.verdict,
              ],
            }))}
          />
        )}
      </Panel>

      <Panel title="Scenarios">
        <DataTable
          caption="Bull, base and bear earnings scenarios"
          columns={['Scenario', 'EPS estimate', 'Revenue estimate', 'Illustrative price reaction', 'Rationale']}
          rows={analysis.scenarios.map((scenario) => ({
            key: scenario.name,
            cells: [
              scenario.name,
              formatNumber(scenario.epsEstimate),
              formatNumber(scenario.revenueEstimate, 0),
              formatPercent(scenario.priceReactionPercent),
              scenario.rationale,
            ],
          }))}
        />
        <Disclaimer>
          Scenarios describe a range of outcomes sized from the reported history and, when available, the options
          market. They are not predictions of the next result.
        </Disclaimer>
      </Panel>
    </div>
  )
}
