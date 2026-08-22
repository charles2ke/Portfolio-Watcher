import type { Provider } from '../lib/types'

interface Props {
  onSignIn: (provider: Provider) => void
}

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: 'microsoft', label: 'Continue with Microsoft', hint: 'Work or personal account' },
  { id: 'google', label: 'Continue with Google', hint: 'Google Workspace or Gmail' },
  { id: 'guest', label: 'Continue as guest', hint: 'Stored only on this device' },
]

export function LoginScreen({ onSignIn }: Props) {
  return (
    <main className="login" aria-labelledby="login-title">
      <section className="login__card">
        <p className="login__eyebrow">Portfolio Watcher</p>
        <h1 id="login-title">Track every move of your portfolio.</h1>
        <p className="login__lede">
          Watch tickers in real time, set dip and rise thresholds, and get alerted on email, SMS or
          WhatsApp.
        </p>
        <div className="login__actions">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`btn btn--${provider.id === 'guest' ? 'ghost' : 'primary'}`}
              onClick={() => onSignIn(provider.id)}
            >
              <span>{provider.label}</span>
              <small>{provider.hint}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
