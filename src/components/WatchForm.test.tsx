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
    email: 'ada@example.com',
    phone: '',
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
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))

    expect(onAdd).toHaveBeenCalledWith({
      symbol: 'msft',
      dipPercent: 3,
      risePercent: 4,
      channels: ['email'],
      email: 'ada@example.com',
      phone: '',
    })
    expect(screen.getByLabelText('Ticker symbol')).toHaveValue('')
  })

  it('shows the destination field matching the selected channels', async () => {
    const { onAdd } = setup()
    await userEvent.click(screen.getByLabelText('Email'))
    expect(screen.queryByLabelText('Email address')).toBeNull()
    expect(screen.queryByLabelText('Phone number')).toBeNull()

    await userEvent.click(screen.getByLabelText('WhatsApp'))
    await userEvent.click(screen.getByLabelText('SMS'))
    expect(screen.getByLabelText('Phone number')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Ticker symbol'), 'TSLA')
    await userEvent.type(screen.getByLabelText('Phone number'), '+15551234567')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ channels: ['whatsapp', 'sms'], phone: '+15551234567' }),
    )
  })

  it('supports email and phone channels together', async () => {
    const { onAdd } = setup()
    await userEvent.click(screen.getByLabelText('WhatsApp'))
    await userEvent.type(screen.getByLabelText('Ticker symbol'), 'NVDA')
    await userEvent.type(screen.getByLabelText('Email address'), 'ada@example.com')
    await userEvent.type(screen.getByLabelText('Phone number'), '+15551234567')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: ['email', 'whatsapp'],
        email: 'ada@example.com',
        phone: '+15551234567',
      }),
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
    await userEvent.type(screen.getByLabelText('Email address'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    expect(screen.getByRole('alert')).toHaveTextContent('valid email address')
    expect(onAdd).not.toHaveBeenCalled()
  })
})
