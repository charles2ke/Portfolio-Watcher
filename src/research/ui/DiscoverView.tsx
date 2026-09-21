import { useMemo, useState } from 'react'
import {
  METRICS,
  compareRows,
  createSavedScreen,
  screen,
  sortRows,
  toCsv,
  toXlsxXml,
  type MetricDefinition,
  type MetricKey,
  type SavedScreen,
  type ScreenerCriteria,
  type SortDirection,
} from '../screener'
import { COUNTRIES, SECTORS } from '../universe'
import { downloadCsv, downloadXlsx } from '../download'
import { formatNumber } from '../format'
import { DataTable, Disclaimer, Panel } from './primitives'
import { formatMetric } from './metricFormat'
import type { ResearchWatchlist } from '../types'

interface Props {
  screens: SavedScreen[]
  watchlists: ResearchWatchlist[]
  onSaveScreen: (screen: SavedScreen) => void
  onDeleteScreen: (id: string) => void
  onAddToWatchlist: (watchlistId: string, ticker: string) => void
  onOpenCompany: (ticker: string) => void
}

const FILTER_METRICS: MetricKey[] = [
  'marketCap',
  'revenueGrowth',
  'peRatio',
  'evToEbitda',
  'roic',
  'dividendYield',
]

export function DiscoverView({
  screens,
  watchlists,
  onSaveScreen,
  onDeleteScreen,
  onAddToWatchlist,
  onOpenCompany,
}: Props) {
  const [criteria, setCriteria] = useState<ScreenerCriteria>({})
  const [sortKey, setSortKey] = useState<MetricKey | 'ticker'>('marketCap')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [selected, setSelected] = useState<string[]>([])
  const [screenName, setScreenName] = useState('')
  const [watchlistId, setWatchlistId] = useState(watchlists[0]?.id ?? '')
  const [status, setStatus] = useState('')

  const rows = useMemo(() => sortRows(screen(criteria), sortKey, direction), [criteria, sortKey, direction])
  const comparison = useMemo(() => compareRows(rows, selected), [rows, selected])

  function setRange(key: MetricKey, bound: 'min' | 'max', raw: string) {
    setCriteria((current) => {
      const ranges = { ...(current.ranges ?? {}) }
      const range = { ...(ranges[key] ?? {}) }
      if (raw === '') delete range[bound]
      else range[bound] = Number(raw)
      if (range.min === undefined && range.max === undefined) delete ranges[key]
      else ranges[key] = range
      return { ...current, ranges }
    })
  }

  function toggleSelected(ticker: string) {
    setSelected((current) =>
      current.includes(ticker) ? current.filter((entry) => entry !== ticker) : [...current, ticker],
    )
  }

  return (
    <div className="stack">
      <Panel
        title="Stock screener"
        subtitle={`${rows.length} of the connected universe match the current criteria`}
      >
        <div className="filters">
          <label>
            Sector
            <select
              value={criteria.sectors?.[0] ?? ''}
              onChange={(event) =>
                setCriteria((current) => ({
                  ...current,
                  sectors: event.target.value === '' ? [] : [event.target.value],
                }))
              }
            >
              <option value="">All sectors</option>
              {SECTORS.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
          </label>
          <label>
            Geography
            <select
              value={criteria.countries?.[0] ?? ''}
              onChange={(event) =>
                setCriteria((current) => ({
                  ...current,
                  countries: event.target.value === '' ? [] : [event.target.value],
                }))
              }
            >
              <option value="">All countries</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </label>
          {FILTER_METRICS.map((key) => {
            const definition = METRICS.find((metric) => metric.key === key) as MetricDefinition
            return (
              <fieldset key={key} className="filters__range">
                <legend>{definition.label}</legend>
                <label>
                  Min
                  <input
                    type="number"
                    step={definition.step}
                    value={criteria.ranges?.[key]?.min ?? ''}
                    onChange={(event) => setRange(key, 'min', event.target.value)}
                  />
                </label>
                <label>
                  Max
                  <input
                    type="number"
                    step={definition.step}
                    value={criteria.ranges?.[key]?.max ?? ''}
                    onChange={(event) => setRange(key, 'max', event.target.value)}
                  />
                </label>
              </fieldset>
            )
          })}
        </div>

        <div className="filters__row">
          <label>
            Sort by
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as MetricKey)}>
              <option value="ticker">Ticker</option>
              {METRICS.map((metric) => (
                <option key={metric.key} value={metric.key}>
                  {metric.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
          >
            {direction === 'asc' ? 'Ascending' : 'Descending'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setStatus(downloadCsv('screen.csv', toCsv(rows)) ? 'CSV exported' : 'Export unavailable')}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() =>
              setStatus(downloadXlsx('screen.xlsx', toXlsxXml(rows)) ? 'XLSX exported' : 'Export unavailable')
            }
          >
            Export XLSX
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCriteria({})}>
            Reset filters
          </button>
        </div>

        <DataTable
          caption="Screener results"
          columns={['Ticker', 'Company', 'Sector', 'Market cap', 'Revenue growth', 'P/E', 'ROIC', 'Yield', 'Compare', 'Watch']}
          rows={rows.map((row) => ({
            key: row.ticker,
            cells: [
              <button key="ticker" type="button" className="link" onClick={() => onOpenCompany(row.ticker)}>
                {row.ticker}
              </button>,
              row.name,
              row.sector,
              formatNumber(row.metrics.marketCap, 0),
              `${formatNumber(row.metrics.revenueGrowth * 100, 1)}%`,
              formatNumber(row.metrics.peRatio, 1),
              `${formatNumber(row.metrics.roic * 100, 1)}%`,
              `${formatNumber(row.metrics.dividendYield, 2)}%`,
              <label key="compare" className="checkbox">
                <input
                  type="checkbox"
                  checked={selected.includes(row.ticker)}
                  onChange={() => toggleSelected(row.ticker)}
                />
                <span className="sr-only">{`Compare ${row.ticker}`}</span>
              </label>,
              <button
                key="watch"
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={watchlistId === ''}
                onClick={() => {
                  onAddToWatchlist(watchlistId, row.ticker)
                  setStatus(`${row.ticker} added to watchlist`)
                }}
              >
                Add
              </button>,
            ],
          }))}
        />
        <div className="filters__row">
          <label>
            Watchlist
            <select value={watchlistId} onChange={(event) => setWatchlistId(event.target.value)}>
              {watchlists.map((watchlist) => (
                <option key={watchlist.id} value={watchlist.id}>
                  {watchlist.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Save this screen as
            <input
              type="text"
              value={screenName}
              onChange={(event) => setScreenName(event.target.value)}
              placeholder="Quality compounders"
            />
          </label>
          <button
            type="button"
            className="btn btn--sm"
            disabled={screenName.trim() === ''}
            onClick={() => {
              onSaveScreen(
                createSavedScreen(
                  `screen-${Date.now()}`,
                  screenName.trim(),
                  criteria,
                  new Date().toISOString(),
                ),
              )
              setScreenName('')
              setStatus('Screen saved')
            }}
          >
            Save screen
          </button>
        </div>
        {status === '' ? null : (
          <p className="status" role="status">
            {status}
          </p>
        )}
        <Disclaimer>
          Screening values are read directly from the structured financial records of each security. No metric on this
          table is model-generated.
        </Disclaimer>
      </Panel>

      {selected.length > 0 ? (
        <Panel title="Comparison mode" subtitle={selected.join(' · ')}>
          <DataTable
            caption="Selected securities compared"
            columns={['Metric', ...selected]}
            rows={comparison.map((entry) => ({
              key: entry.metric.key,
              cells: [
                entry.metric.label,
                ...entry.values.map((value) => formatMetric(entry.metric, value.value)),
              ],
            }))}
          />
        </Panel>
      ) : null}

      <Panel title="Saved screens">
        {screens.length === 0 ? (
          <p className="empty">No saved screens yet.</p>
        ) : (
          <ul className="dashboard__list">
            {screens.map((saved) => (
              <li key={saved.id}>
                <button type="button" className="link" onClick={() => setCriteria(saved.criteria)}>
                  {saved.name}
                </button>{' '}
                · saved {saved.createdAt.slice(0, 10)}{' '}
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDeleteScreen(saved.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
