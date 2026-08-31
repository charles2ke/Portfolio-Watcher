import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen } from './LoginScreen'
import { SetupPage } from './SetupPage'
import { Header } from './Header'
import { ThemeToggle } from './ThemeToggle'
import { Sparkline } from './Sparkline'
import { AlertsPanel } from './AlertsPanel'
import { TickerCard } from './TickerCard'
import type { Quote, User, Watch } from '../lib/types'

const user: User = { id: '1', name: 'Ada', email: 'ada@example.com', provider: 'google' }

const watch: Watch = {
  id: 'w1',
  symbol: 'MSFT',
  dipPercent: 5,
  risePercent: 5,
  channels: ['email', 'whatsapp'],
  email: 'ada@example.com',
  phone: '+15551234567',
}

const quote = (changePercent: number): Quote => ({
  symbol: 'MSFT',
  price: 123.456,
  previousClose: 120,
  changePercent,
  currency: 'USD',
  series: [120, 121, 123.456],
})

describe('LoginScreen', () => {
  it('offers Microsoft, Google and guest sign-in', async () => {
    const onSignIn = vi.fn()
    render(<LoginScreen onSignIn={onSignIn} />)
    await userEvent.click(screen.getByRole('button', { name: /Microsoft/ }))
    await userEvent.click(screen.getByRole('button', { name: /Google/ }))
    await userEvent.click(screen.getByRole('button', { name: /guest/ }))
    expect(onSignIn.mock.calls.flat()).toEqual(['microsoft', 'google', 'guest'])
  })
})

describe('ThemeToggle', () => {
  it('reflects the active theme', async () => {
    const onToggle = vi.fn()
    const { rerender } = render(<ThemeToggle theme="light" onToggle={onToggle} />)
    const button = screen.getByTestId('theme-toggle')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(onToggle).toHaveBeenCalled()
    rerender(<ThemeToggle theme="dark" onToggle={onToggle} />)
    expect(screen.getByTestId('theme-toggle')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Header', () => {
  it('shows the user and logs out', async () => {
    const onSignOut = vi.fn()
    render(<Header user={user} theme="dark" onToggleTheme={vi.fn()} onSignOut={onSignOut} />)
    expect(screen.getByTestId('current-user')).toHaveTextContent('Ada')
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(onSignOut).toHaveBeenCalled()
  })
})

describe('Sparkline', () => {
  it('renders a polyline for a series', () => {
    render(<Sparkline series={[1, 2, 3]} positive label="MSFT movement" />)
    const svg = screen.getByRole('img', { name: 'MSFT movement' })
    expect(svg).toHaveClass('sparkline--up')
    expect(svg.querySelectorAll('polyline')).toHaveLength(2)
  })

  it('renders nothing for an empty series', () => {
    render(<Sparkline series={[]} positive={false} label="empty" />)
    const svg = screen.getByRole('img', { name: 'empty' })
    expect(svg).toHaveClass('sparkline--down')
    expect(svg.querySelectorAll('polyline')).toHaveLength(0)
  })
})

describe('AlertsPanel', () => {
  it('shows an empty state', () => {
    render(<AlertsPanel alerts={[]} />)
    expect(screen.getByTestId('alerts-empty')).toBeInTheDocument()
  })

  it('lists triggered alerts', () => {
    render(
      <AlertsPanel
        alerts={[
          {
            symbol: 'MSFT',
            direction: 'dip',
            changePercent: -7,
            threshold: 5,
            channels: ['sms'],
            destinations: ['+15551234567'],
          },
        ]}
      />,
    )
    expect(screen.getByRole('listitem')).toHaveTextContent('MSFT dropped 7.00%')
  })
})

describe('TickerCard', () => {
  it('shows a loading state without a quote', () => {
    render(<TickerCard watch={watch} onRemove={vi.fn()} />)
    expect(screen.getByText('Loading quote…')).toBeInTheDocument()
  })

  it('renders the price, channels and rise alert', () => {
    render(<TickerCard watch={watch} quote={quote(8)} onRemove={vi.fn()} />)
    expect(screen.getByText(/123\.46/)).toBeInTheDocument()
    expect(screen.getByText(/8\.00%/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Rise alert sent to ada@example.com, +15551234567',
    )
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Email',
      'WhatsApp',
    ])
  })

  it('renders a dip alert', () => {
    render(<TickerCard watch={watch} quote={quote(-8)} onRemove={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Dip alert sent to')
  })

  it('renders no alert inside the thresholds', () => {
    render(<TickerCard watch={watch} quote={quote(1)} onRemove={vi.fn()} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('removes the ticker', async () => {
    const onRemove = vi.fn()
    render(<TickerCard watch={watch} quote={quote(1)} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: /Remove MSFT/ }))
    expect(onRemove).toHaveBeenCalledWith('w1')
  })
})

describe('SetupPage', () => {
  it('rejects an invalid symbol and completes with a normalized one', async () => {
    const onComplete = vi.fn()
    render(<SetupPage onComplete={onComplete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('alert')).toHaveTextContent('valid ticker symbol')

    await userEvent.type(screen.getByLabelText('First ticker symbol'), 'msft')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onComplete).toHaveBeenCalledWith('MSFT')
  })

  it('can be skipped', async () => {
    const onComplete = vi.fn()
    render(<SetupPage onComplete={onComplete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(onComplete).toHaveBeenCalledWith('')
  })
})
