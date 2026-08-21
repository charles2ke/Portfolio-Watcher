import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { navigate } from './lib/navigation'
import { STORAGE_KEYS, writeJSON } from './lib/storage'
import type { Watch } from './lib/types'

vi.mock('./lib/navigation', () => ({ navigate: vi.fn() }))

const watch: Watch = {
  id: 'w1',
  symbol: 'MSFT',
  dipPercent: 0.01,
  risePercent: 0.01,
  channels: ['email'],
  destination: 'ada@example.com',
}

beforeEach(() => {
  window.location.hash = ''
})

afterEach(() => {
  vi.useRealTimers()
})

async function signInAsGuest() {
  render(<App />)
  await userEvent.click(screen.getByRole('button', { name: /guest/i }))
}

describe('App', () => {
  it('shows the login screen first and signs in as guest', async () => {
    await signInAsGuest()
    expect(screen.getByTestId('current-user')).toHaveTextContent('Guest')
    expect(screen.getByTestId('watchlist-empty')).toBeInTheDocument()
  })

  it('restores an existing session and watchlist', async () => {
    writeJSON(STORAGE_KEYS.user, { id: '1', name: 'Ada', email: '', provider: 'google' })
    writeJSON(STORAGE_KEYS.watches, [watch])
    render(<App />)
    expect(screen.getByTestId('current-user')).toHaveTextContent('Ada')
    await waitFor(() => expect(screen.getByTestId('ticker-MSFT')).toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByRole('status').length).toBeGreaterThan(0))
  })

  it('completes a redirect sign-in from the url fragment', () => {
    const payload = btoa(JSON.stringify({ sub: 'abc', name: 'Grace' })).replace(/=+$/, '')
    window.location.hash = `#id_token=header.${payload}.sig`
    render(<App />)
    expect(screen.getByTestId('current-user')).toHaveTextContent('Grace')
  })

  it('adds and removes a ticker', async () => {
    await signInAsGuest()
    await userEvent.type(screen.getByLabelText('Ticker symbol'), 'MSFT')
    await userEvent.type(screen.getByLabelText('Send alerts to'), 'ada@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Add to watchlist' }))

    const card = await screen.findByTestId('ticker-MSFT')
    expect(card).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Remove MSFT/ }))
    expect(screen.queryByTestId('ticker-MSFT')).toBeNull()
    expect(screen.getByTestId('watchlist-empty')).toBeInTheDocument()
  })

  it('ignores quote results after unmount', async () => {
    writeJSON(STORAGE_KEYS.user, { id: '1', name: 'Ada', email: '', provider: 'guest' })
    writeJSON(STORAGE_KEYS.watches, [watch])
    const { unmount } = render(<App />)
    unmount()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByTestId('ticker-MSFT')).toBeNull()
  })

  it('toggles the dark theme', async () => {
    await signInAsGuest()
    expect(document.documentElement.dataset.theme).toBe('light')
    await userEvent.click(screen.getByTestId('theme-toggle'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('logs out back to the login screen', async () => {
    await signInAsGuest()
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEYS.user)).toBeNull()
  })

  it('redirects to the identity provider when configured', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-id')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /Google/ }))
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('accounts.google.com'))
    expect(screen.queryByTestId('current-user')).toBeNull()
    vi.unstubAllEnvs()
  })

  it('refreshes quotes on an interval', async () => {
    writeJSON(STORAGE_KEYS.user, { id: '1', name: 'Ada', email: '', provider: 'guest' })
    writeJSON(STORAGE_KEYS.watches, [watch])
    vi.useFakeTimers()
    await act(async () => {
      render(<App />)
    })
    const before = screen.getByTestId('ticker-MSFT').textContent
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(screen.getByTestId('ticker-MSFT').textContent).not.toBe(before)
  })
})
