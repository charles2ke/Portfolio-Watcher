import { useState } from 'react'
import { getCompany } from '../universe'
import { formatNumber, formatPercent } from '../format'
import { DataTable, Panel } from './primitives'
import type { ResearchAlert, ResearchWatchlist } from '../types'

interface Props {
  watchlists: ResearchWatchlist[]
  alerts: ResearchAlert[]
  onChange: (watchlists: ResearchWatchlist[]) => void
  onOpenCompany: (ticker: string) => void
}

export function WatchlistsView({ watchlists, alerts, onChange, onOpenCompany }: Props) {
  const [name, setName] = useState('')
  const [tickerByList, setTickerByList] = useState<Record<string, string>>({})

  return (
    <div className="stack">
      <Panel title="Watchlists" subtitle={`${watchlists.length} lists`}>
        <div className="filters__row">
          <label>
            New watchlist
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button
            type="button"
            className="btn btn--sm"
            disabled={name.trim() === ''}
            onClick={() => {
              onChange([...watchlists, { id: `wl-${Date.now()}`, name: name.trim(), tickers: [] }])
              setName('')
            }}
          >
            Create watchlist
          </button>
        </div>
      </Panel>

      {watchlists.map((watchlist) => (
        <Panel
          key={watchlist.id}
          title={watchlist.name}
          actions={
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onChange(watchlists.filter((entry) => entry.id !== watchlist.id))}
            >
              Delete list
            </button>
          }
        >
          <div className="filters__row">
            <label>
              Add ticker
              <input
                type="text"
                value={tickerByList[watchlist.id] ?? ''}
                onChange={(event) =>
                  setTickerByList((current) => ({ ...current, [watchlist.id]: event.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => {
                const raw = (tickerByList[watchlist.id] ?? '').trim().toUpperCase()
                const company = getCompany(raw)
                if (!company) return
                const symbol = company.security.ticker
                onChange(
                  watchlists.map((entry) =>
                    entry.id === watchlist.id && !entry.tickers.includes(symbol)
                      ? { ...entry, tickers: [...entry.tickers, symbol] }
                      : entry,
                  ),
                )
                setTickerByList((current) => ({ ...current, [watchlist.id]: '' }))
              }}
            >
              Add
            </button>
          </div>
          <DataTable
            caption={`${watchlist.name} securities`}
            columns={['Ticker', 'Company', 'Price', '12M move', 'Forward P/E', 'Next earnings', 'Alerts', '']}
            rows={watchlist.tickers.flatMap((ticker) => {
              const company = getCompany(ticker)
              if (!company) return []
              const alertCount = alerts.filter((alert) => alert.subject === ticker).length
              return [
                {
                  key: ticker,
                  cells: [
                    <button key="ticker" type="button" className="link" onClick={() => onOpenCompany(ticker)}>
                      {ticker}
                    </button>,
                    company.security.name,
                    formatNumber(company.prices[company.prices.length - 1].close),
                    formatPercent(company.fundamentals.momentum12m),
                    formatNumber(company.fundamentals.forwardPe),
                    company.nextEarningsDate,
                    alertCount === 0 ? 'none' : `${alertCount} triggered`,
                    <button
                      key="remove"
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() =>
                        onChange(
                          watchlists.map((entry) =>
                            entry.id === watchlist.id
                              ? { ...entry, tickers: entry.tickers.filter((item) => item !== ticker) }
                              : entry,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>,
                  ],
                },
              ]
            })}
          />
        </Panel>
      ))}
    </div>
  )
}
