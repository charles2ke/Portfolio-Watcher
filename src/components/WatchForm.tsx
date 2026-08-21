import { useState } from 'react'
import { ALERT_CHANNELS, CHANNEL_LABELS, destinationHint, isValidDestination } from '../lib/alerts'
import { toggleChannel, validateDraft } from '../lib/watchlist'
import type { WatchDraft } from '../lib/watchlist'
import type { AlertChannel, Watch } from '../lib/types'

interface Props {
  watches: Watch[]
  onAdd: (draft: WatchDraft) => void
}

const EMPTY: WatchDraft = {
  symbol: '',
  dipPercent: 5,
  risePercent: 5,
  channels: ['email'],
  destination: '',
}

export function WatchForm({ watches, onAdd }: Props) {
  const [draft, setDraft] = useState<WatchDraft>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  const update = <K extends keyof WatchDraft>(key: K, value: WatchDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateDraft(draft, watches)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!isValidDestination(draft.channels, draft.destination)) {
      setError('Enter a valid destination for the selected alert channels.')
      return
    }
    setError(null)
    onAdd(draft)
    setDraft(EMPTY)
  }

  return (
    <form className="card watch-form" onSubmit={handleSubmit} aria-labelledby="watch-form-title">
      <h2 id="watch-form-title">Add a ticker</h2>

      <label className="field">
        <span>Ticker symbol</span>
        <input
          name="symbol"
          value={draft.symbol}
          placeholder="MSFT"
          autoComplete="off"
          onChange={(event) => update('symbol', event.target.value)}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Alert on dip %</span>
          <input
            name="dipPercent"
            type="number"
            min="0"
            step="0.1"
            value={draft.dipPercent}
            onChange={(event) => update('dipPercent', Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Alert on rise %</span>
          <input
            name="risePercent"
            type="number"
            min="0"
            step="0.1"
            value={draft.risePercent}
            onChange={(event) => update('risePercent', Number(event.target.value))}
          />
        </label>
      </div>

      <fieldset className="field">
        <legend>Alert channels</legend>
        <div className="chips">
          {ALERT_CHANNELS.map((channel: AlertChannel) => (
            <label key={channel} className="chip">
              <input
                type="checkbox"
                checked={draft.channels.includes(channel)}
                onChange={() => update('channels', toggleChannel(draft.channels, channel))}
              />
              <span>{CHANNEL_LABELS[channel]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Send alerts to</span>
        <input
          name="destination"
          value={draft.destination}
          placeholder={destinationHint(draft.channels)}
          autoComplete="off"
          onChange={(event) => update('destination', event.target.value)}
        />
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn--primary">
        Add to watchlist
      </button>
    </form>
  )
}
