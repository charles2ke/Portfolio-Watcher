import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscoverView } from './DiscoverView'
import { defaultWatchlists } from '../store'
import type { SavedScreen } from '../screener'
import type { ResearchWatchlist } from '../types'

function renderDiscover(overrides: {
  screens?: SavedScreen[]
  watchlists?: ResearchWatchlist[]
} = {}) {
  const onSaveScreen = vi.fn()
  const onDeleteScreen = vi.fn()
  const onAddToWatchlist = vi.fn()
  const onOpenCompany = vi.fn()
  render(
    <DiscoverView
      screens={overrides.screens ?? []}
      watchlists={overrides.watchlists ?? defaultWatchlists()}
      onSaveScreen={onSaveScreen}
      onDeleteScreen={onDeleteScreen}
      onAddToWatchlist={onAddToWatchlist}
      onOpenCompany={onOpenCompany}
    />,
  )
  return { onSaveScreen, onDeleteScreen, onAddToWatchlist, onOpenCompany }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DiscoverView', () => {
  it('sets and clears min/max range filters', () => {
    renderDiscover()
    const fieldset = screen.getByRole('group', { name: 'Market cap (m)' })
    const min = within(fieldset).getByLabelText('Min')
    const max = within(fieldset).getByLabelText('Max')

    fireEvent.change(min, { target: { value: '1000' } })
    expect(min).toHaveValue(1000)
    fireEvent.change(max, { target: { value: '500000' } })
    expect(max).toHaveValue(500000)

    fireEvent.change(min, { target: { value: '' } })
    expect(min).toHaveValue(null)
    fireEvent.change(max, { target: { value: '' } })
    expect(max).toHaveValue(null)
  })

  it('filters by sector and geography and back to All', async () => {
    renderDiscover()
    const sector = screen.getByLabelText('Sector')
    const geography = screen.getByLabelText('Geography')

    await userEvent.selectOptions(sector, 'Energy')
    expect(sector).toHaveValue('Energy')
    await userEvent.selectOptions(sector, 'All sectors')
    expect(sector).toHaveValue('')

    await userEvent.selectOptions(geography, 'United States')
    expect(geography).toHaveValue('United States')
    await userEvent.selectOptions(geography, 'All countries')
    expect(geography).toHaveValue('')
  })

  it('changes the sort key and toggles the direction', async () => {
    renderDiscover()
    const sort = screen.getByLabelText('Sort by')
    await userEvent.selectOptions(sort, 'Ticker')
    expect(sort).toHaveValue('ticker')
    await userEvent.selectOptions(sort, 'ROIC')
    expect(sort).toHaveValue('roic')

    const toggle = screen.getByRole('button', { name: 'Descending' })
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Ascending' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ascending' }))
    expect(screen.getByRole('button', { name: 'Descending' })).toBeInTheDocument()
  })

  it('exports CSV and XLSX when object URLs are available', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(globalThis.URL, { createObjectURL, revokeObjectURL }))
    renderDiscover()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(screen.getByRole('status')).toHaveTextContent('CSV exported')
    await userEvent.click(screen.getByRole('button', { name: 'Export XLSX' }))
    expect(screen.getByRole('status')).toHaveTextContent('XLSX exported')
    expect(createObjectURL).toHaveBeenCalledTimes(2)
  })

  it('reports when exports are unavailable', async () => {
    vi.stubGlobal('URL', { createObjectURL: undefined })
    renderDiscover()
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(screen.getByRole('status')).toHaveTextContent('Export unavailable')
    await userEvent.click(screen.getByRole('button', { name: 'Export XLSX' }))
    expect(screen.getByRole('status')).toHaveTextContent('Export unavailable')
  })

  it('resets the filters', async () => {
    renderDiscover()
    const fieldset = screen.getByRole('group', { name: 'Market cap (m)' })
    const min = within(fieldset).getByLabelText('Min')
    fireEvent.change(min, { target: { value: '1000' } })
    expect(min).toHaveValue(1000)
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(within(screen.getByRole('group', { name: 'Market cap (m)' })).getByLabelText('Min')).toHaveValue(null)
  })

  it('compares selected securities, including a filtered-out ticker', async () => {
    renderDiscover()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Compare ARCL' }))
    expect(screen.getByText('Comparison mode')).toBeInTheDocument()
    expect(screen.getByText('Selected securities compared')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Sector'), 'Energy')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)

    await userEvent.selectOptions(screen.getByLabelText('Sector'), 'All sectors')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Compare ARCL' }))
    expect(screen.queryByText('Comparison mode')).toBeNull()
  })

  it('disables watchlist actions when there are no watchlists', () => {
    renderDiscover({ watchlists: [] })
    expect(screen.getAllByRole('button', { name: 'Add' })[0]).toBeDisabled()
  })

  it('adds a ticker to the selected watchlist', async () => {
    const { onAddToWatchlist } = renderDiscover()
    await userEvent.selectOptions(screen.getByLabelText('Watchlist'), 'income')
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0])
    expect(onAddToWatchlist).toHaveBeenCalledWith('income', expect.any(String))
    expect(screen.getByRole('status')).toHaveTextContent('added to watchlist')
  })

  it('opens a company from the results table', async () => {
    const { onOpenCompany } = renderDiscover()
    await userEvent.click(screen.getByRole('button', { name: 'ARCL' }))
    expect(onOpenCompany).toHaveBeenCalledWith('ARCL')
  })

  it('saves a screen once a name is provided', async () => {
    const { onSaveScreen } = renderDiscover()
    const save = screen.getByRole('button', { name: 'Save screen' })
    expect(save).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Save this screen as'), 'Quality compounders')
    expect(save).toBeEnabled()
    await userEvent.click(save)
    expect(onSaveScreen).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Screen saved')
  })

  it('shows the empty saved-screens state', () => {
    renderDiscover({ screens: [] })
    expect(screen.getByText('No saved screens yet.')).toBeInTheDocument()
  })

  it('loads and deletes a saved screen', async () => {
    const saved: SavedScreen = {
      id: 's1',
      name: 'Saved idea',
      criteria: { sectors: ['Energy'] },
      createdAt: '2026-09-01T00:00:00.000Z',
    }
    const { onDeleteScreen } = renderDiscover({ screens: [saved] })
    expect(screen.getByText('saved 2026-09-01', { exact: false })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Saved idea' }))
    expect(screen.getByLabelText('Sector')).toHaveValue('Energy')
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDeleteScreen).toHaveBeenCalledWith('s1')
  })
})
