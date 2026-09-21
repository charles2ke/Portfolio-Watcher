import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardView } from './DashboardView'
import { defaultPortfolio, defaultWatchlists } from '../store'
import { createReport } from '../reports'
import { getCompany } from '../universe'
import type { SavedScreen } from '../screener'
import type { Portfolio, ResearchAlert, ResearchReport } from '../types'

const companyReport: ResearchReport = createReport({
  id: 'r1',
  title: 'Arclight deep dive',
  module: 'company',
  ticker: 'ARCL',
  createdAt: '2026-09-18T10:00:00.000Z',
  assumptions: {},
  snapshot: {},
  sources: [getCompany('ARCL')!.provenance],
})

const portfolioReport: ResearchReport = createReport({
  id: 'r2',
  title: 'Portfolio review',
  module: 'portfolio',
  ticker: null,
  createdAt: '2026-09-17T10:00:00.000Z',
  assumptions: {},
  snapshot: {},
  sources: [],
})

const screen1: SavedScreen = {
  id: 's1',
  name: 'Quality growth',
  criteria: {},
  createdAt: '2026-09-16T10:00:00.000Z',
}

const alert: ResearchAlert = {
  id: 'a1',
  type: 'concentration',
  subject: 'ARCL',
  message: 'exceeds 20% of the portfolio',
  severity: 'warning',
}

function renderDashboard(overrides: Partial<ComponentProps<typeof DashboardView>> = {}) {
  const onOpenCompany = vi.fn()
  const onNavigate = vi.fn()
  render(
    <DashboardView
      portfolio={defaultPortfolio()}
      watchlists={defaultWatchlists()}
      reports={[companyReport, portfolioReport]}
      screens={[screen1]}
      alerts={[alert]}
      onOpenCompany={onOpenCompany}
      onNavigate={onNavigate}
      {...overrides}
    />,
  )
  return { onOpenCompany, onNavigate }
}

describe('DashboardView', () => {
  it('renders reports, screens and alerts, and wires callbacks', async () => {
    const { onOpenCompany, onNavigate } = renderDashboard()

    expect(screen.getByText('Arclight deep dive')).toBeInTheDocument()
    expect(screen.getByText('Quality growth')).toBeInTheDocument()
    expect(screen.getByText(/exceeds 20%/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open portfolio' }))
    expect(onNavigate).toHaveBeenCalledWith('portfolio')

    await userEvent.click(screen.getByRole('button', { name: 'Arclight deep dive' }))
    expect(onOpenCompany).toHaveBeenCalledWith('ARCL')

    await userEvent.click(screen.getByRole('button', { name: 'Portfolio review' }))
    expect(onNavigate).toHaveBeenCalledWith('reports')

    await userEvent.click(screen.getByRole('button', { name: 'Quality growth' }))
    expect(onNavigate).toHaveBeenCalledWith('discover')

    await userEvent.click(screen.getByRole('button', { name: 'Screen the universe' }))
    await userEvent.click(screen.getByRole('button', { name: 'Macro exposure' }))
    await userEvent.click(screen.getByRole('button', { name: 'Research reports' }))
    expect(onNavigate).toHaveBeenCalledWith('macro')

    const watchButton = screen.getAllByRole('button', { name: 'CNVX' })[0]
    await userEvent.click(watchButton)
    expect(onOpenCompany).toHaveBeenCalledWith('CNVX')

    await userEvent.click(screen.getByRole('button', { name: 'VLGR' }))
    expect(onOpenCompany).toHaveBeenCalledWith('VLGR')
  })

  it('shows empty states when reports, screens and alerts are absent', () => {
    renderDashboard({ reports: [], screens: [], alerts: [] })
    expect(screen.getByText('No alert rules have triggered.')).toBeInTheDocument()
    expect(screen.getByText('Saved analyses appear here.')).toBeInTheDocument()
    expect(screen.getByText('Save a screen in Discover to reuse it here.')).toBeInTheDocument()
  })

  it('uses the ARCL provenance fallback when the portfolio has no positions', () => {
    const emptyPortfolio: Portfolio = { ...defaultPortfolio(), positions: [] }
    renderDashboard({
      portfolio: emptyPortfolio,
      watchlists: [{ id: 'w', name: 'W', tickers: ['NOPE', 'ARCL'] }],
    })
    expect(screen.getByText('Portfolio value')).toBeInTheDocument()
    expect(document.querySelector('.provenance')).toBeInTheDocument()
  })
})
