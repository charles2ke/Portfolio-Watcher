import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PortfolioView } from './PortfolioView'
import { DEFAULT_PROFILE, defaultPortfolio } from '../store'
import { NOT_AVAILABLE } from '../format'
import type { Portfolio } from '../types'

function renderView(overrides: Partial<Portfolio> = {}) {
  const onChangePortfolio = vi.fn()
  const onChangeProfile = vi.fn()
  const onOpenCompany = vi.fn()
  const onSaveReport = vi.fn()
  render(
    <PortfolioView
      portfolio={{ ...defaultPortfolio(), ...overrides }}
      profile={DEFAULT_PROFILE}
      onChangePortfolio={onChangePortfolio}
      onChangeProfile={onChangeProfile}
      onOpenCompany={onOpenCompany}
      onSaveReport={onSaveReport}
    />,
  )
  return { onChangePortfolio, onChangeProfile, onOpenCompany, onSaveReport }
}

describe('PortfolioView', () => {
  it('rejects an unusable position entry', async () => {
    const { onChangePortfolio } = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Add position' }))
    expect(screen.getByRole('status')).toHaveTextContent('Enter a known ticker and a positive quantity.')
    expect(onChangePortfolio).not.toHaveBeenCalled()
  })

  it('adds a new position and increases an existing one', async () => {
    const { onChangePortfolio } = renderView()
    await userEvent.type(screen.getByLabelText('Ticker'), 'cnvx')
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '10' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add position' }))
    expect(screen.getByRole('status')).toHaveTextContent('CNVX added.')
    const added = onChangePortfolio.mock.calls[0][0] as Portfolio
    expect(added.positions.some((position) => position.ticker === 'CNVX')).toBe(true)
    expect(added.transactions).toHaveLength(1)

    await userEvent.type(screen.getByLabelText('Ticker'), 'ARCL')
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '5' } })
    await userEvent.click(screen.getByRole('button', { name: 'Add position' }))
    const increased = onChangePortfolio.mock.calls[1][0] as Portfolio
    expect(increased.positions.find((position) => position.ticker === 'ARCL')?.quantity).toBe(325)
  })

  it('removes a position, opens a company and edits cash and benchmark', async () => {
    const { onChangePortfolio, onOpenCompany } = renderView()
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    const removed = onChangePortfolio.mock.calls[0][0] as Portfolio
    expect(removed.positions.some((position) => position.ticker === 'ARCL')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'ARCL' }))
    expect(onOpenCompany).toHaveBeenCalledWith('ARCL')

    fireEvent.change(screen.getByLabelText('Cash'), { target: { value: '1000' } })
    expect((onChangePortfolio.mock.calls[1][0] as Portfolio).cash).toBe(1000)

    await userEvent.selectOptions(screen.getByLabelText('Benchmark'), 'all-equity')
    expect((onChangePortfolio.mock.calls[2][0] as Portfolio).benchmark).toBe('all-equity')
  })

  it('falls back to not-available statistics for an unknown benchmark', () => {
    renderView({ benchmark: '' })
    expect(screen.getByText('Benchmark expected return').parentElement).toHaveTextContent(NOT_AVAILABLE)
  })

  it('saves a risk report', async () => {
    const { onSaveReport } = renderView()
    await userEvent.click(screen.getByRole('button', { name: 'Save risk report' }))
    expect(onSaveReport).toHaveBeenCalledWith(
      'Portfolio risk',
      null,
      expect.objectContaining({ positions: 5 }),
      expect.objectContaining({ beta: expect.any(Number) }),
    )
    expect(screen.getByRole('status')).toHaveTextContent('Risk report saved.')
  })

  it('edits the investor profile and toggles alternatives', async () => {
    const { onChangeProfile } = renderView()
    fireEvent.change(screen.getByLabelText('Investment amount'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Horizon (years)'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Income requirement (%)'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Liquidity reserve (%)'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Monthly contribution'), { target: { value: '900' } })
    await userEvent.selectOptions(screen.getByLabelText('Risk tolerance'), 'aggressive')
    await userEvent.selectOptions(screen.getByLabelText('Account type'), 'tax-free')
    expect(onChangeProfile).toHaveBeenCalledTimes(7)

    await userEvent.click(screen.getByLabelText('Include alternatives'))
    expect(screen.getAllByText('Alternatives').length).toBeGreaterThan(0)
  })

  it('excludes holdings without dividend data from income analytics', () => {
    renderView({ positions: [{ ticker: 'NBLA', quantity: 100 }] })
    expect(screen.getByText(/No dividend data for/)).toBeInTheDocument()
  })

  it('reports unavailable liquidity for a cash-only portfolio', () => {
    renderView({ positions: [] })
    expect(screen.getByText('Days to liquidate').parentElement).toHaveTextContent(NOT_AVAILABLE)
  })

  it('lists recorded transactions', () => {
    renderView({
      transactions: [
        { id: 't1', date: '2026-09-01', ticker: 'ARCL', type: 'buy', quantity: 10, price: 180 },
      ],
    })
    expect(screen.getByText('2026-09-01')).toBeInTheDocument()
  })

  it('shows income analytics when every holding pays a dividend', () => {
    renderView({ positions: [{ ticker: 'AQFL', quantity: 100 }] })
    expect(screen.queryByText(/No dividend data for/)).toBeNull()
  })
})
