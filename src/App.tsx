import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertsPanel } from './components/AlertsPanel'
import { Header } from './components/Header'
import { LoginScreen } from './components/LoginScreen'
import { SetupPage } from './components/SetupPage'
import { TickerCard } from './components/TickerCard'
import { WatchForm } from './components/WatchForm'
import { completeSignIn, loadUser, signIn, signOut } from './lib/auth'
import { evaluateWatches } from './lib/alerts'
import { fetchQuote } from './lib/market'
import { applyTheme, initialTheme, nextTheme } from './lib/theme'
import { createWatch, loadWatches, removeWatch, saveWatches } from './lib/watchlist'
import { newId } from './lib/ids'
import { navigate } from './lib/navigation'
import type { WatchDraft } from './lib/watchlist'
import type { Provider, Quote, Theme, User, Watch } from './lib/types'

const REFRESH_MS = 15000

export default function App() {
  const [user, setUser] = useState<User | null>(
    () => completeSignIn(globalThis.location.hash) ?? loadUser(),
  )
  const [watches, setWatches] = useState<Watch[]>(() => loadWatches())
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [theme, setTheme] = useState<Theme>(() => initialTheme())
  const [tick, setTick] = useState(0)
  const [setupComplete, setSetupComplete] = useState(watches.length > 0)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    saveWatches(watches)
  }, [watches])

  useEffect(() => {
    if (watches.length === 0) return
    let cancelled = false
    void Promise.all(watches.map((watch) => fetchQuote(watch.symbol, tick))).then((results) => {
      if (cancelled) return
      setQuotes((current) => {
        const next = { ...current }
        for (const quote of results) next[quote.symbol] = quote
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [watches, tick])

  useEffect(() => {
    const timer = globalThis.setInterval(() => setTick((value) => value + 1), REFRESH_MS)
    return () => globalThis.clearInterval(timer)
  }, [])

  const handleSignIn = useCallback((provider: Provider) => {
    const signedIn = signIn(provider, navigate)
    if (signedIn) setUser(signedIn)
  }, [])

  const handleSignOut = useCallback(() => {
    signOut()
    setUser(null)
  }, [])

  const handleSetupComplete = useCallback((symbol: string) => {
    setSetupComplete(true)
    // Symbol will be added through the WatchForm on the main dashboard
  }, [])

  const handleAdd = useCallback((draft: WatchDraft) => {
    setWatches((current) => [...current, createWatch(draft, newId())])
  }, [])

  const handleRemove = useCallback((id: string) => {
    setWatches((current) => removeWatch(current, id))
  }, [])

  const alerts = useMemo(() => evaluateWatches(watches, quotes), [watches, quotes])

  if (!user) return <LoginScreen onSignIn={handleSignIn} />

  if (!setupComplete) return <SetupPage onComplete={handleSetupComplete} />

  return (
    <div className="app">
      <Header
        user={user}
        theme={theme}
        onToggleTheme={() => setTheme((current) => nextTheme(current))}
        onSignOut={handleSignOut}
      />
      <main className="layout">
        <div className="layout__side">
          <WatchForm watches={watches} onAdd={handleAdd} />
          <AlertsPanel alerts={alerts} />
        </div>
        <section className="layout__main" aria-labelledby="watchlist-title">
          <h2 id="watchlist-title">Your watchlist</h2>
          {watches.length === 0 ? (
            <p className="empty" data-testid="watchlist-empty">
              Add a ticker symbol to start watching price movements.
            </p>
          ) : (
            <div className="grid">
              {watches.map((watch) => (
                <TickerCard
                  key={watch.id}
                  watch={watch}
                  quote={quotes[watch.symbol]}
                  onRemove={handleRemove}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
