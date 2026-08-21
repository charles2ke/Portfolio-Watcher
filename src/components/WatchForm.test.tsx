import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WatchForm } from './WatchForm'
import type { Watch } from '../lib/types'

const existing: Watch[] = [
  {
    id: 'w1',
    symbol: 'AAPL',
    dipPercent: 5,
    risePercent: 5,
    channels: ['email'],
    destination: 'ada@example.com',
  },
]

function setup(watches: Watch[] = []) {
  const onAdd = vi.fn()
  render(<WatchForm watches={watches} onAdd={onAdd} />)
  return { onAdd }
}

describe('WatchForm', () => {
  it('adds a valid watch and resets the form', async () => {
    const { onAdd } = setup()
    await userEvent.type(screen.getByLabelText('Ticker symbol'), 'msft')
    await userEvent.clear(screen.getByLabelText('Alert on dip %'))
    await userEvent.type(screen.getByLabelText('Alert on dip %'), '3')
    await userEvent.clear(screen.getByLabelText('Alert on rise %'))
    await userEvent.type(screen.getByLabelText('Alert on rise %'), '4')
    await userEvent.type(screen.getByLabelText('Send alerts to'), 'ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))

    expect(onAdd).toHaveBeenCalledWith({
      symbol: 'msft',
      dipPercent: 3,
      risePercent: 4,
      channels: ['email'],
      destination: 'ada@example.com',
    })
    expect(screen.getByLabelText('Ticker symbol')).toHaveValue('')
  })

  it('toggles alert channels and updates the destination hint', async () => {
    const { onAdd } = setup()
    await userEvent.click(screen.getByLabelText('Email'))
    expect(screen.getByLabelText('Send alerts to')).toHaveAttribute(
      'placeholder',
      'Select at least one alert channel',
    )
    await userEvent.click(screen.getByLabelText('WhatsApp'))
    await userEvent.click(screen.getByLabelText('SMS'))
    expect(screen.getByLabelText('Send alerts to')).toHaveAttribute(
      'placeholder',
      '+15551234567',
    )
    await userEvent.type(screen.getByLabelText('Ticker symbol'), 'TSLA')
    await userEvent.type(screen.getByLabelText('Send alerts to'), '+15551234567')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ['whatsapp', 'sms'], destination: '+15551234567' }),
    )
  })

  it('rejects an invalid draft', async () => {
    const { onAdd } = setup(existing)
    await userEvent.type(screen.getByLabelText('Ticker symbol'), 'aapl')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    expect(screen.getByRole('alert')).toHaveTextContent('already on your watchlist')
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('rejects an invalid destination', async () => {
    const { onAdd } = setup()
    await userEvent.type(screen.getByLabelText('Ticker symbol'), 'MSFT')
    await userEvent.type(screen.getByLabelText('Send alerts to'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    expect(screen.getByRole('alert')).toHaveTextContent('valid destination')
    expect(onAdd).not.toHaveBeenCalled()
  })
})
