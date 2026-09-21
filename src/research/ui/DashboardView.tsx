import { Disclaimer, LineChart, MetricGrid, Panel, ProvenanceNote } from './primitives'
import { MARKET_INDEX, MARKET_INDEX_NAME, getCompany } from '../universe'
import { upcomingEarnings } from '../earnings'
import { MACRO_CALENDAR, MACRO_SERIES, changeOver, latestValue, yieldCurveSpread } from '../macro'
import { buildHoldings, riskMetrics } from '../risk'
import { formatCurrency, formatNumber, formatPercent } from '../format'
import { roundTo } from '../../lib/numbers'
import type { Portfolio, ResearchAlert, ResearchReport, ResearchWatchlist } from '../types'
import type { SavedScreen } from '../screener'
import type { ModuleId } from './modules'

interface Props {
  portfolio: Portfolio
  watchlists: ResearchWatchlist[]
  reports: ResearchReport[]
  screens: SavedScreen[]
  alerts: ResearchAlert[]
  onOpenCompany: (ticker: string) => void
  onNavigate: (module: ModuleId) => void
}

export function DashboardView({
  portfolio,
  watchlists,
  reports,
  screens,
  alerts,
  onOpenCompany,
  onNavigate,
}: Props) {
  const holdings = buildHoldings(portfolio.positions, portfolio.cash)
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0)
  const metrics = riskMetrics(holdings)
  const watchTickers = watchlists.flatMap((watchlist) => watchlist.tickers)
  const indexSeries = MARKET_INDEX.slice(-60).map((point) => point.close)
  const indexChange = roundTo(
    ((indexSeries[indexSeries.length - 1] - indexSeries[0]) / indexSeries[0]) * 100,
  )

  return (
    <div className="dashboard">
      <Panel title="Portfolio value" subtitle={portfolio.name}>
        <MetricGrid
          items={[
            { label: 'Total value', value: formatCurrency(roundTo(totalValue), 'USD', 0) },
            { label: 'Positions', value: String(portfolio.positions.length) },
            { label: 'Cash', value: formatCurrency(portfolio.cash, 'USD', 0) },
            { label: 'Portfolio beta', value: formatNumber(metrics.beta) },
            { label: 'Annualised volatility', value: formatPercent(metrics.annualVolatility) },
            { label: 'Max drawdown', value: formatPercent(metrics.maxDrawdown) },
          ]}
        />
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('portfolio')}>
          Open portfolio
        </button>
      </Panel>

      <Panel title="Market overview" subtitle={MARKET_INDEX_NAME}>
        <LineChart series={indexSeries} label={MARKET_INDEX_NAME} positive={indexChange >= 0} />
        <p className="dashboard__note">
          {formatPercent(indexChange)} over the last 60 sessions · yield curve{' '}
          {formatPercent(yieldCurveSpread(), 2)}
        </p>
      </Panel>

      <Panel title="Watchlist" subtitle={`${watchTickers.length} securities`}>
        <ul className="dashboard__list">
          {watchTickers.map((ticker) => {
            const company = getCompany(ticker)
            if (!company) return null
            return (
              <li key={ticker}>
                <button type="button" className="link" onClick={() => onOpenCompany(ticker)}>
                  {ticker}
                </button>{' '}
                {formatNumber(company.prices[company.prices.length - 1].close)}{' '}
                {company.security.currency} · {formatPercent(company.fundamentals.momentum12m)} 12M
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel title="Upcoming earnings">
        <ul className="dashboard__list">
          {upcomingEarnings([
            ...new Set([...portfolio.positions.map((position) => position.ticker), ...watchTickers]),
          ]).map(
            (entry) => (
              <li key={entry.ticker}>
                <button type="button" className="link" onClick={() => onOpenCompany(entry.ticker)}>
                  {entry.ticker}
                </button>{' '}
                {entry.name} · {entry.date}
              </li>
            ),
          )}
        </ul>
      </Panel>

      <Panel title="Macro calendar">
        <ul className="dashboard__list">
          {MACRO_CALENDAR.map((event) => (
            <li key={`${event.date}-${event.label}`}>
              {event.date} · {event.label} <span className={`pill is-${event.importance}`}>{event.importance}</span>
            </li>
          ))}
        </ul>
        <p className="dashboard__note">
          Policy rate {formatPercent(latestValue(MACRO_SERIES[0]))} ({formatNumber(changeOver(MACRO_SERIES[0], 12))}{' '}
          over 12 months)
        </p>
      </Panel>

      <Panel title="Portfolio risk alerts">
        {alerts.length === 0 ? (
          <p className="empty">No alert rules have triggered.</p>
        ) : (
          <ul className="dashboard__list">
            {alerts.map((alert) => (
              <li key={alert.id} className={`alert is-${alert.severity}`}>
                <strong>{alert.subject}</strong> {alert.message}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Recent research">
        {reports.length === 0 ? (
          <p className="empty">Saved analyses appear here.</p>
        ) : (
          <ul className="dashboard__list">
            {reports.slice(0, 5).map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  className="link"
                  onClick={() => (report.ticker ? onOpenCompany(report.ticker) : onNavigate('reports'))}
                >
                  {report.title}
                </button>{' '}
                · {report.module} · {report.createdAt.slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Saved screens">
        {screens.length === 0 ? (
          <p className="empty">Save a screen in Discover to reuse it here.</p>
        ) : (
          <ul className="dashboard__list">
            {screens.map((screen) => (
              <li key={screen.id}>
                <button type="button" className="link" onClick={() => onNavigate('discover')}>
                  {screen.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Analysis shortcuts">
        <div className="dashboard__shortcuts">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('discover')}>
            Screen the universe
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('macro')}>
            Macro exposure
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('reports')}>
            Research reports
          </button>
        </div>
      </Panel>

      <Panel title="Data provenance">
        <ProvenanceNote
          sources={[getCompany(portfolio.positions[0]?.ticker ?? 'ARCL')?.provenance, MACRO_SERIES[0].provenance].filter(
            (source) => source !== undefined,
          )}
        />
        <Disclaimer>
          Figures come from the connected data sources listed above. Interpretation text is generated from those
          calculated values and is research, not investment advice.
        </Disclaimer>
      </Panel>
    </div>
  )
}
