interface Props {
  onComplete: () => void
}

const STEPS: { title: string; detail: string }[] = [
  { title: 'Add your tickers', detail: 'Search any symbol and keep it on your watchlist.' },
  { title: 'Pick your thresholds', detail: 'Choose the dip and rise percentages that matter.' },
  { title: 'Choose alert channels', detail: 'Get notified by email, SMS or WhatsApp.' },
]

export function SetupPage({ onComplete }: Props) {
  return (
    <main className="login" aria-labelledby="setup-title">
      <section className="login__card" data-testid="setup-page">
        <p className="login__eyebrow">Setup</p>
        <h1 id="setup-title">Let&rsquo;s set up your watchlist.</h1>
        <p className="login__lede">
          Three quick things to know before you start tracking your portfolio.
        </p>
        <ol className="login__actions">
          {STEPS.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <br />
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn--primary" onClick={onComplete}>
          <span>Continue to dashboard</span>
        </button>
      </section>
    </main>
  )
}
