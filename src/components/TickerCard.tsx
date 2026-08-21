import { Sparkline } from './Sparkline'
import { CHANNEL_LABELS, evaluateWatch } from '../lib/alerts'
import type { Quote, Watch } from '../lib/types'

interface Props {
  watch: Watch
  quote?: Quote
  onRemove: (id: string) => void
}

export function TickerCard({ watch, quote, onRemove }: Props) {
  const alert = quote ? evaluateWatch(watch, quote) : null
  const positive = (quote?.changePercent ?? 0) >= 0

  return (
    <article className="card ticker" data-testid={`ticker-${watch.symbol}`}>
      <div className="ticker__head">
        <div>
          <h3 className="ticker__symbol">{watch.symbol}</h3>
          <p className="ticker__meta">
            Dip {watch.dipPercent}% · Rise {watch.risePercent}%
          </p>
        </div>
        <button
          type="button"
          className="btn btn--icon btn--danger"
          aria-label={`Remove ${watch.symbol} from watchlist`}
          onClick={() => onRemove(watch.id)}
        >
          ✕
        </button>
      </div>

      {quote ? (
        <>
          <div className="ticker__price">
            <span className="ticker__value">
              {quote.price.toFixed(2)} <small>{quote.currency}</small>
            </span>
            <span className={`ticker__change ${positive ? 'is-up' : 'is-down'}`}>
              {positive ? '▲' : '▼'} {Math.abs(quote.changePercent).toFixed(2)}%
            </span>
          </div>
          <Sparkline
            series={quote.series}
            positive={positive}
            label={`${watch.symbol} price movement`}
          />
        </>
      ) : (
        <p className="ticker__loading">Loading quote…</p>
      )}

      <ul className="ticker__channels">
        {watch.channels.map((channel) => (
          <li key={channel}>{CHANNEL_LABELS[channel]}</li>
        ))}
      </ul>

      {alert ? (
        <p className={`ticker__alert is-${alert.direction}`} role="status">
          {alert.direction === 'dip' ? 'Dip' : 'Rise'} alert sent to{' '}
          {alert.destinations.join(', ')}
        </p>
      ) : null}
    </article>
  )
}
