import { competitiveLandscape, type PeerMetricRow } from '../competition'
import { formatNumber, NOT_AVAILABLE } from '../format'
import { DataTable, Panel } from './primitives'
import type { CompanyRecord } from '../types'

function formatPeerValue(row: PeerMetricRow, value: number | null): string {
  if (value === null) return NOT_AVAILABLE
  if (row.unit === 'percent') return `${formatNumber(value, 1)}%`
  if (row.unit === 'currency-millions') return `${formatNumber(value, 0)}m`
  return formatNumber(value)
}

export function CompanyCompetition({ company }: { company: CompanyRecord }) {
  const landscape = competitiveLandscape(company.security.ticker)
  if (!landscape) return null
  const tickers = [landscape.company, ...landscape.peers].map((entry) => entry.security.ticker)

  return (
    <div className="stack">
      <Panel title="Peer comparison" subtitle={`Peer set: ${landscape.peers.map((peer) => peer.security.ticker).join(', ')}`}>
        <DataTable
          caption="Company versus peers"
          columns={['Metric', ...tickers]}
          rows={landscape.table.map((row) => ({
            key: row.metric,
            cells: [row.metric, ...row.values.map((value) => formatPeerValue(row, value.value))],
          }))}
        />
      </Panel>

      <Panel title="Competitive dimensions" subtitle="Scored 0–10 from the sourced moat assessment">
        <DataTable
          caption="Moat dimensions"
          columns={['Dimension', ...tickers]}
          rows={landscape.moat.map((row) => ({
            key: row.dimension,
            cells: [
              row.dimension,
              ...row.values.map((value) => (value.score === null ? NOT_AVAILABLE : formatNumber(value.score, 1))),
            ],
          }))}
        />
      </Panel>

      <Panel title="Market share trend">
        {landscape.marketShare.map((series) => (
          <div key={series.ticker} className="market-share">
            <h4>{series.ticker}</h4>
            {series.points === null ? (
              <p className="empty">
                No reliable market-share data is connected for {series.ticker}; no figure is estimated.
              </p>
            ) : (
              <ul className="inline-list">
                {series.points.map((point) => (
                  <li key={point.year}>
                    {point.year}: {formatNumber(point.sharePercent, 1)}%
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Panel>

      {landscape.qualitative.map((section) => (
        <Panel key={section.title} title={section.title}>
          {section.available ? (
            <ul className="dashboard__list">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="empty">{NOT_AVAILABLE}</p>
          )}
        </Panel>
      ))}
    </div>
  )
}
