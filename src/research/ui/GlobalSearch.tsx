import { useMemo, useState } from 'react'
import { searchSecurities } from '../universe'
import type { Security } from '../types'

/** Global security search, available from every module. */
export function GlobalSearch({ onSelect }: { onSelect: (ticker: string) => void }) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchSecurities(query), [query])

  return (
    <div className="global-search">
      <label className="global-search__label" htmlFor="global-search-input">
        Search companies, tickers or exchanges
      </label>
      <input
        id="global-search-input"
        type="search"
        autoComplete="off"
        className="global-search__input"
        placeholder="e.g. ARCL, Nebula, NASDAQ"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {results.length > 0 ? (
        <ul className="global-search__results">
          {results.map((security: Security) => (
            <li key={security.ticker}>
              <button
                type="button"
                className="global-search__result"
                onClick={() => {
                  onSelect(security.ticker)
                  setQuery('')
                }}
              >
                <strong>{security.ticker}</strong> {security.name}
                <small>
                  {security.exchange} · {security.sector} · {security.currency}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim().length > 0 && results.length === 0 ? (
        <p className="global-search__empty">No security matches “{query}”.</p>
      ) : null}
    </div>
  )
}
