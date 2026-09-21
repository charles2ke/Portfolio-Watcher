import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MODULES, type ModuleId } from './modules'
import { GlobalSearch } from './GlobalSearch'
import { DashboardView } from './DashboardView'
import { DiscoverView } from './DiscoverView'
import { CompanyView } from './CompanyView'
import { PortfolioView } from './PortfolioView'
import { MacroView } from './MacroView'
import { WatchlistsView } from './WatchlistsView'
import { ReportsView } from './ReportsView'
import { SettingsView } from './SettingsView'
import { buildHoldings } from '../risk'
import { defaultRules, evaluateRules, type AlertRule } from '../researchAlerts'
import { createReport } from '../reports'
import { AS_OF, getCompany } from '../universe'
import { MACRO_SERIES } from '../macro'
import {
  defaultPortfolio,
  defaultWatchlists,
  loadPortfolios,
  loadProfile,
  loadReports,
  loadRules,
  loadScreens,
  loadWatchlists,
  savePortfolios,
  saveProfile,
  saveReports,
  saveRules,
  saveScreens,
  saveWatchlists,
} from '../store'
import type { SavedScreen } from '../screener'
import type { InvestorProfile, Portfolio, ResearchReport, ResearchWatchlist } from '../types'

/** The research platform shell: navigation, global search and every module. */
export function ResearchWorkspace({ alertsSlot }: { alertsSlot: ReactNode }) {
  const [module, setModule] = useState<ModuleId>('dashboard')
  const [ticker, setTicker] = useState<string | null>(null)
  const [portfolios, setPortfolios] = useState<Portfolio[]>(() => {
    const stored = loadPortfolios()
    return stored.length > 0 ? stored : [defaultPortfolio()]
  })
  const [portfolioId, setPortfolioId] = useState<string>(() => '')
  const [watchlists, setWatchlists] = useState<ResearchWatchlist[]>(() => {
    const stored = loadWatchlists()
    return stored.length > 0 ? stored : defaultWatchlists()
  })
  const [reports, setReports] = useState<ResearchReport[]>(() => loadReports())
  const [screens, setScreens] = useState<SavedScreen[]>(() => loadScreens())
  const [profile, setProfile] = useState<InvestorProfile>(() => loadProfile())

  const portfolio = portfolios.find((entry) => entry.id === portfolioId) ?? portfolios[0]

  const [rules, setRules] = useState<AlertRule[]>(() =>
    loadRules(defaultRules(defaultPortfolio().positions.map((position) => position.ticker))),
  )

  useEffect(() => savePortfolios(portfolios), [portfolios])
  useEffect(() => saveWatchlists(watchlists), [watchlists])
  useEffect(() => saveReports(reports), [reports])
  useEffect(() => saveScreens(screens), [screens])
  useEffect(() => saveProfile(profile), [profile])
  useEffect(() => saveRules(rules), [rules])

  const alerts = useMemo(() => {
    const holdings = buildHoldings(portfolio.positions).map((holding) => ({
      ticker: holding.ticker,
      weight: holding.weight,
    }))
    return evaluateRules(rules, { today: AS_OF, holdings })
  }, [rules, portfolio])

  function openCompany(next: string) {
    setTicker(next)
    setModule('company')
  }

  function addToWatchlist(watchlistId: string, symbol: string) {
    setWatchlists((current) =>
      current.map((watchlist) =>
        watchlist.id === watchlistId && !watchlist.tickers.includes(symbol)
          ? { ...watchlist, tickers: [...watchlist.tickers, symbol] }
          : watchlist,
      ),
    )
  }

  function saveReport(
    moduleName: string,
    reportTicker: string | null,
    assumptions: Record<string, number | string | null>,
    snapshot: Record<string, number | string | null>,
  ) {
    const company = reportTicker === null ? undefined : getCompany(reportTicker)
    setReports((current) => [
      createReport({
        id: `report-${Date.now()}`,
        title: reportTicker === null ? moduleName : `${reportTicker} · ${moduleName}`,
        module: moduleName,
        ticker: reportTicker,
        createdAt: new Date().toISOString(),
        assumptions,
        snapshot,
        sources: company ? [company.provenance] : [MACRO_SERIES[0].provenance],
      }),
      ...current,
    ])
  }

  return (
    <div className="workspace">
      <nav className="workspace__nav" aria-label="Research modules">
        <ul>
          {MODULES.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={`workspace__nav-item ${module === entry.id ? 'is-active' : ''}`}
                aria-current={module === entry.id ? 'page' : undefined}
                onClick={() => setModule(entry.id)}
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
        <label className="workspace__portfolio">
          Portfolio
          <select value={portfolio.id} onChange={(event) => setPortfolioId(event.target.value)}>
            {portfolios.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            const created = { ...defaultPortfolio(), id: `pf-${Date.now()}`, name: `Portfolio ${portfolios.length + 1}`, positions: [], transactions: [] }
            setPortfolios((current) => [...current, created])
            setPortfolioId(created.id)
          }}
        >
          New portfolio
        </button>
      </nav>

      <main className="workspace__main">
        <GlobalSearch onSelect={openCompany} />
        <h2 className="workspace__title">{MODULES.find((entry) => entry.id === module)?.label}</h2>

        {module === 'dashboard' ? (
          <DashboardView
            portfolio={portfolio}
            watchlists={watchlists}
            reports={reports}
            screens={screens}
            alerts={alerts}
            onOpenCompany={openCompany}
            onNavigate={setModule}
          />
        ) : null}
        {module === 'discover' ? (
          <DiscoverView
            screens={screens}
            watchlists={watchlists}
            onSaveScreen={(saved) => setScreens((current) => [saved, ...current])}
            onDeleteScreen={(id) => setScreens((current) => current.filter((entry) => entry.id !== id))}
            onAddToWatchlist={addToWatchlist}
            onOpenCompany={openCompany}
          />
        ) : null}
        {module === 'company' ? (
          <CompanyView
            ticker={ticker}
            watchlists={watchlists}
            onAddToWatchlist={addToWatchlist}
            onSaveReport={saveReport}
          />
        ) : null}
        {module === 'portfolio' ? (
          <PortfolioView
            portfolio={portfolio}
            profile={profile}
            onChangePortfolio={(next) =>
              setPortfolios((current) => current.map((entry) => (entry.id === next.id ? next : entry)))
            }
            onChangeProfile={setProfile}
            onOpenCompany={openCompany}
            onSaveReport={saveReport}
          />
        ) : null}
        {module === 'macro' ? <MacroView portfolio={portfolio} /> : null}
        {module === 'watchlists' ? (
          <WatchlistsView
            watchlists={watchlists}
            alerts={alerts}
            onChange={setWatchlists}
            onOpenCompany={openCompany}
          />
        ) : null}
        {module === 'reports' ? (
          <ReportsView
            reports={reports}
            onDelete={(id) => setReports((current) => current.filter((entry) => entry.id !== id))}
          />
        ) : null}
        {module === 'alerts' ? alertsSlot : null}
        {module === 'settings' ? (
          <SettingsView rules={rules} alerts={alerts} onChangeRules={setRules} />
        ) : null}
      </main>
    </div>
  )
}
