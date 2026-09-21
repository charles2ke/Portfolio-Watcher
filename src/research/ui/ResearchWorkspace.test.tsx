import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResearchWorkspace } from './ResearchWorkspace'
import { RESEARCH_KEYS } from '../store'

function renderWorkspace() {
  render(<ResearchWorkspace alertsSlot={<p>Legacy price alerts</p>} />)
}

async function openModule(name: string) {
  await userEvent.click(within(screen.getByLabelText('Research modules')).getByRole('button', { name }))
}

async function searchAndOpen(ticker: string) {
  await userEvent.type(screen.getByLabelText('Search companies, tickers or exchanges'), ticker)
  const results = await screen.findAllByRole('button', { name: new RegExp(ticker) })
  const result = results.find((button) => button.className.includes('global-search__result'))
  await userEvent.click(result as HTMLElement)
}

describe('ResearchWorkspace', () => {
  it('navigates across every module without losing context', async () => {
    renderWorkspace()
    expect(screen.getByText('Legacy price alerts')).toBeInTheDocument()

    for (const name of ['Dashboard', 'Discover', 'Portfolio', 'Macro', 'Watchlists', 'Reports', 'Settings']) {
      await openModule(name)
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(name)
    }

    await openModule('Price Alerts')
    expect(screen.getByText('Legacy price alerts')).toBeInTheDocument()
  })

  it('opens a company from global search and keeps it selected', async () => {
    renderWorkspace()
    await searchAndOpen('ARCL')
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Company Research')

    await openModule('Dashboard')
    await openModule('Company Research')
    expect(screen.getAllByText(/ARCL/).length).toBeGreaterThan(0)
  })

  it('creates and switches portfolios', async () => {
    renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'New portfolio' }))
    const select = screen.getByLabelText('Portfolio')
    expect(screen.getByRole('option', { name: 'Portfolio 2' })).toBeInTheDocument()
    await userEvent.selectOptions(select, 'core')
    expect(select).toHaveValue('core')
  })

  it('saves a portfolio report and then deletes it', async () => {
    renderWorkspace()
    await openModule('Portfolio')
    await userEvent.click(screen.getByRole('button', { name: 'Save risk report' }))
    await openModule('Reports')
    expect(screen.getByText('Portfolio risk')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText(/Save a DCF, risk or screening analysis/)).toBeInTheDocument()
  })

  it('adds a security to a watchlist from the company page without duplicating it', async () => {
    renderWorkspace()
    await searchAndOpen('ARCL')
    const addButton = screen.getAllByRole('button', { name: /Add to/ })[0]
    await userEvent.click(addButton)
    await userEvent.click(addButton)
    await openModule('Watchlists')
    expect(screen.getAllByRole('button', { name: 'ARCL' })).toHaveLength(1)
  })

  it('saves a company report with the security provenance attached', async () => {
    renderWorkspace()
    await searchAndOpen('ARCL')
    await userEvent.click(screen.getByRole('tab', { name: 'Valuation' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save DCF as report' }))
    await openModule('Reports')
    expect(screen.getAllByText(/ARCL · DCF valuation/).length).toBeGreaterThan(0)
  })

  it('persists portfolio edits made in the portfolio module', async () => {
    renderWorkspace()
    await userEvent.click(screen.getByRole('button', { name: 'New portfolio' }))
    await openModule('Portfolio')
    fireEvent.change(screen.getByLabelText('Cash'), { target: { value: '1234' } })
    expect(screen.getByLabelText('Cash')).toHaveValue(1234)
  })

  it('saves and removes a screen from Discover', async () => {
    renderWorkspace()
    await openModule('Discover')
    await userEvent.type(screen.getByLabelText('Save this screen as'), 'Quality growth')
    await userEvent.click(screen.getByRole('button', { name: 'Save screen' }))
    expect(screen.getByText('Quality growth')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.queryByText('Quality growth')).toBeNull()
  })

  it('falls back to the first portfolio when the selected id is unknown', () => {
    renderWorkspace()
    const select = screen.getByLabelText('Portfolio')
    fireEvent.change(select, { target: { value: 'does-not-exist' } })
    expect(select).toHaveValue('core')
  })

  it('falls back to defaults when stored collections are empty', () => {
    localStorage.setItem(RESEARCH_KEYS.portfolios, '[]')
    localStorage.setItem(RESEARCH_KEYS.watchlists, '[]')
    renderWorkspace()
    expect(screen.getByRole('option', { name: 'Core portfolio' })).toBeInTheDocument()
  })
})
