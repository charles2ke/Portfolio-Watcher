import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MacroView } from './MacroView'
import { WatchlistsView } from './WatchlistsView'
import { ReportsView } from './ReportsView'
import { SettingsView } from './SettingsView'
import { defaultPortfolio, defaultWatchlists } from '../store'
import { defaultRules } from '../researchAlerts'
import { createReport } from '../reports'
import { UNIVERSE } from '../universe'
import { NOT_AVAILABLE } from '../format'
import type { ResearchAlert } from '../types'

const alert: ResearchAlert = {
  id: 'a1',
  type: 'price',
  subject: 'ARCL',
  message: 'ARCL moved 4% on the last session.',
  severity: 'warning',
}

const report = createReport({
  id: 'r1',
  title: 'ARCL · DCF valuation',
  module: 'DCF valuation',
  ticker: 'ARCL',
  createdAt: '2026-09-18T10:00:00.000Z',
  assumptions: { wacc: 0.09, method: 'perpetuity', note: null },
  snapshot: { valuePerShare: 120.5, upsidePercent: null },
  sources: [UNIVERSE[0].provenance],
})

describe('MacroView', () => {
  it('shows observed data, the exposure map and a scenario estimate', async () => {
    render(<MacroView portfolio={defaultPortfolio()} />)
    expect(screen.getByText('Observed economic data')).toBeInTheDocument()
    expect(screen.getByText('Macro to portfolio exposure map')).toBeInTheDocument()
    expect(screen.getByText('Estimated portfolio impact')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Scenario'), 'recession')
    expect(screen.getByText(/Scenario output is an estimate/)).toBeInTheDocument()
  })

  it('falls back to a neutral chart when a series has no comparable history', async () => {
    vi.resetModules()
    vi.doMock('../macro', async () => {
      const actual = await vi.importActual<typeof import('../macro')>('../macro')
      return { ...actual, changeOver: () => null }
    })
    const { MacroView: Patched } = await import('./MacroView')
    render(<Patched portfolio={defaultPortfolio()} />)
    expect(screen.getAllByText(/12-month change/)[0]).toHaveTextContent(NOT_AVAILABLE)
    vi.doUnmock('../macro')
    vi.resetModules()
  })

  it('reports when a scenario cannot be resolved', () => {
    render(<MacroView portfolio={defaultPortfolio()} />)
    fireEvent.change(screen.getByLabelText('Scenario'), { target: { value: '' } })
    expect(screen.queryByText('Estimated portfolio impact')).toBeNull()
    expect(screen.getAllByText(NOT_AVAILABLE).length).toBeGreaterThan(0)
  })
})

describe('WatchlistsView', () => {
  it('creates, fills and empties watchlists', async () => {
    const onChange = vi.fn()
    const onOpenCompany = vi.fn()
    const watchlists = defaultWatchlists()
    render(
      <WatchlistsView
        watchlists={watchlists}
        alerts={[alert]}
        onChange={onChange}
        onOpenCompany={onOpenCompany}
      />,
    )

    expect(screen.getByRole('button', { name: 'Create watchlist' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('New watchlist'), 'Deep value')
    await userEvent.click(screen.getByRole('button', { name: 'Create watchlist' }))
    expect(onChange).toHaveBeenCalled()

    const addInputs = screen.getAllByLabelText('Add ticker')
    await userEvent.type(addInputs[0], 'zzzz')
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])
    await userEvent.clear(addInputs[0])
    await userEvent.type(addInputs[0], 'arcl')
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])
    expect(onChange).toHaveBeenCalledTimes(2)

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete list' })[0])
    await userEvent.click(screen.getAllByRole('button', { name: 'CNVX' })[0])
    expect(onOpenCompany).toHaveBeenCalledWith('CNVX')
  })

  it('ignores a ticker that is already on the list', async () => {
    const onChange = vi.fn()
    render(
      <WatchlistsView
        watchlists={[{ id: 'w', name: 'Ideas', tickers: ['ARCL'] }]}
        alerts={[]}
        onChange={onChange}
        onOpenCompany={vi.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText('Add ticker'), 'ARCL')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onChange).toHaveBeenCalledWith([{ id: 'w', name: 'Ideas', tickers: ['ARCL'] }])
  })

  it('skips unknown tickers and shows triggered alert counts', () => {
    render(
      <WatchlistsView
        watchlists={[{ id: 'w', name: 'Mixed', tickers: ['ARCL', 'NOPE'] }]}
        alerts={[alert]}
        onChange={vi.fn()}
        onOpenCompany={vi.fn()}
      />,
    )
    expect(screen.getByText('1 triggered')).toBeInTheDocument()
    expect(screen.queryByText('NOPE')).toBeNull()
  })
})

describe('ReportsView', () => {
  it('shows the empty state', () => {
    render(<ReportsView reports={[]} onDelete={vi.fn()} />)
    expect(screen.getByText(/Save a DCF, risk or screening analysis/)).toBeInTheDocument()
  })

  it('exports and deletes a stored report', async () => {
    const onDelete = vi.fn()
    const createObjectURL = vi.fn(() => 'blob:report')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...globalThis.URL, createObjectURL, revokeObjectURL })
    const print = vi.fn()
    const write = vi.fn()
    const close = vi.fn()
    const focus = vi.fn()
    vi.stubGlobal(
      'open',
      vi.fn(() => ({ document: { write, close }, focus, print })),
    )

    render(<ReportsView reports={[report]} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(screen.getByRole('status')).toHaveTextContent('Report exported as CSV')
    await userEvent.click(screen.getByRole('button', { name: 'Export PDF' }))
    expect(screen.getByRole('status')).toHaveTextContent('Report opened for PDF printing')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith('r1')
    vi.unstubAllGlobals()
  })

  it('reports when exporting is unavailable', async () => {
    vi.stubGlobal('URL', { ...globalThis.URL, createObjectURL: undefined })
    vi.stubGlobal(
      'open',
      vi.fn(() => null),
    )
    render(<ReportsView reports={[report]} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(screen.getByRole('status')).toHaveTextContent('Export is unavailable')
    await userEvent.click(screen.getByRole('button', { name: 'Export PDF' }))
    expect(screen.getByRole('status')).toHaveTextContent('Printing is unavailable')
    vi.unstubAllGlobals()
  })
})

describe('SettingsView', () => {
  it('edits alert rules and lists provenance', async () => {
    const onChangeRules = vi.fn()
    const rules = defaultRules(['ARCL'])
    render(<SettingsView rules={rules} alerts={[]} onChangeRules={onChangeRules} />)
    expect(screen.getByText('No rule is currently triggered.')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('price-ARCL threshold'), { target: { value: '8' } })
    expect(onChangeRules).toHaveBeenCalled()
    await userEvent.click(screen.getByLabelText('macro-default enabled'))
    expect(onChangeRules).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Portfolio Watcher sample dataset')).toBeInTheDocument()
  })

  it('lists triggered alerts', () => {
    render(<SettingsView rules={defaultRules([])} alerts={[alert]} onChangeRules={vi.fn()} />)
    expect(screen.getByText(alert.message)).toBeInTheDocument()
  })
})
