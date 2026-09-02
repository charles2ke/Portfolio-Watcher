interface Props {
  onComplete: () => void
}

const STEPS = [
  'Add the tickers you care about.',
  'Pick the dip and rise thresholds that matter to you.',
  'Choose how you want to be alerted: email, SMS or WhatsApp.',
]

export function SetupPage({ onComplete }: Props) {
  return (
    <main className="login" aria-labelledby="setup-title">
      <section className="login__card" data-testid="setup-page">
        <p className="login__eyebrow">Getting started</p>
        <h1 id="setup-title">Let&apos;s set up your watchlist.</h1>
        <p className="login__lede">Three quick things before your dashboard is ready.</p>
        <ol className="login__lede">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="login__actions">
          <button type="button" className="btn btn--primary" onClick={onComplete}>
            <span>Get started</span>
            <small>Takes less than a minute</small>
          </button>
        </div>
      </section>
    </main>
  )
}
