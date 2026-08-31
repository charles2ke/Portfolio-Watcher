import { useState } from 'react'
import { isValidSymbol, normalizeSymbol } from '../lib/market'

interface Props {
  onComplete: (symbol: string) => void
}

export function SetupPage({ onComplete }: Props) {
  const [symbol, setSymbol] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isValidSymbol(symbol)) {
      setError('Enter a valid ticker symbol, e.g. MSFT.')
      return
    }
    setError(null)
    onComplete(normalizeSymbol(symbol))
  }

  return (
    <main className="login" aria-labelledby="setup-title">
      <section className="login__card">
        <p className="login__eyebrow">Set up your watchlist</p>
        <h1 id="setup-title">Which ticker do you want to watch first?</h1>
        <p className="login__lede">
          Pick a starting symbol and we will take you to the dashboard to finish setting the alert
          thresholds and channels.
        </p>
        <form className="login__actions" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>First ticker symbol</span>
            <input
              name="setupSymbol"
              value={symbol}
              placeholder="MSFT"
              autoComplete="off"
              onChange={(event) => setSymbol(event.target.value)}
            />
          </label>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary">
            Continue
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onComplete('')}>
            Skip for now
          </button>
        </form>
      </section>
    </main>
  )
}
