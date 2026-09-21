import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanyTechnicals } from './CompanyTechnicals'
import { signals, sma } from '../technicals'
import { getCompany } from '../universe'
import type { CompanyRecord, PricePoint } from '../types'

// Delegate to the real technical engine by default. Two branches in the
// component are defensive against empty indicator output that the real engine
// never produces for a non-empty price series (the `last([])` guard and the
// "no signals" empty state), so those specific tests override `sma`/`signals`.
vi.mock('../technicals', async (importActual) => {
  const actual = await importActual<typeof import('../technicals')>()
  return {
    ...actual,
    sma: vi.fn(actual.sma),
    signals: vi.fn(actual.signals),
  }
})

let realSma: typeof import('../technicals')['sma']
let realSignals: typeof import('../technicals')['signals']

beforeAll(async () => {
  const actual = await vi.importActual<typeof import('../technicals')>('../technicals')
  realSma = actual.sma
  realSignals = actual.signals
})

afterEach(() => {
  vi.mocked(sma).mockImplementation(realSma)
  vi.mocked(signals).mockImplementation(realSignals)
})

const company = getCompany('ARCL') as CompanyRecord

const INDICATOR_NAMES = [
  'Moving averages (20/50/100/200)',
  'EMA 21',
  'RSI 14',
  'MACD',
  'Bollinger Bands',
  'ATR 14',
  'Volume average',
  'Fibonacci retracement',
]

// A short, perfectly flat series: no swing pivots are detected, so the
// support/resistance panel renders its "none detected" branches.
function flatPrices(length: number): PricePoint[] {
  return Array.from({ length }, (_, i) => ({
    date: `2026-01-${String((i % 27) + 1).padStart(2, '0')}`,
    high: 100,
    low: 100,
    close: 100,
    volume: 1_000_000,
  }))
}

describe('CompanyTechnicals', () => {
  it('renders default indicators and support/resistance and signals', () => {
    render(<CompanyTechnicals company={company} />)
    expect(screen.getByText('Moving averages')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'RSI 14' })).toBeInTheDocument()
    expect(screen.getByText('MACD', { selector: 'h3' })).toBeInTheDocument()
    expect(screen.getByText('Support and resistance')).toBeInTheDocument()
    expect(screen.getByText('Detected signals')).toBeInTheDocument()
    expect(screen.getByText('Trade planning')).toBeInTheDocument()
    expect(screen.getByText('Position size')).toBeInTheDocument()
  })

  it('toggles every indicator on and off', async () => {
    render(<CompanyTechnicals company={company} />)
    for (const name of INDICATOR_NAMES) {
      await userEvent.click(screen.getByRole('checkbox', { name }))
    }
    // Default-on indicators are now hidden; default-off indicators are now shown.
    expect(screen.getByRole('heading', { name: 'EMA 21' })).toBeInTheDocument()
    expect(screen.getByText('Bollinger Bands (20, 2σ)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ATR 14' })).toBeInTheDocument()
    expect(screen.getByText('Volume', { selector: 'h3' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fibonacci retracement' })).toBeInTheDocument()
    expect(screen.queryByText('Moving averages')).toBeNull()

    // Toggle them back to exercise the reverse transitions too.
    for (const name of INDICATOR_NAMES) {
      await userEvent.click(screen.getByRole('checkbox', { name }))
    }
    expect(screen.getByText('Moving averages')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'EMA 21' })).toBeNull()
  })

  it('switches across every timeframe', async () => {
    render(<CompanyTechnicals company={company} />)
    const select = screen.getByLabelText('Timeframe')
    await userEvent.selectOptions(select, 'weekly')
    expect(screen.getByText(/weekly series/)).toBeInTheDocument()
    await userEvent.selectOptions(select, 'monthly')
    expect(screen.getByText(/monthly series/)).toBeInTheDocument()
    await userEvent.selectOptions(select, 'daily')
    expect(screen.getByText(/daily series/)).toBeInTheDocument()
  })

  it('computes a trade plan and handles entry === stop', () => {
    render(<CompanyTechnicals company={company} />)
    // Default entry === stop === 0 renders the null position-size branch.
    expect(
      screen.getByText('Position size').closest('.metric-grid__item')?.querySelector('dd')?.textContent,
    ).toBe('n/a')

    fireEvent.change(screen.getByLabelText('entry'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('stop'), { target: { value: '90' } })
    fireEvent.change(screen.getByLabelText('target'), { target: { value: '120' } })
    fireEvent.change(screen.getByLabelText('accountSize'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('riskPercent'), { target: { value: '2' } })

    // Now the position size is a concrete number, not "n/a".
    const positionCell = screen.getByText('Position size').closest('.metric-grid__item')
    expect(positionCell?.querySelector('dd')?.textContent).not.toBe('n/a')

    // Set the stop equal to entry to hit the null risk/reward branch again.
    fireEvent.change(screen.getByLabelText('stop'), { target: { value: '100' } })
    expect(
      screen.getByText('Position size').closest('.metric-grid__item')?.querySelector('dd')?.textContent,
    ).toBe('n/a')
  })

  it('reports "none detected" when no support or resistance pivots exist', () => {
    render(<CompanyTechnicals company={{ ...company, prices: flatPrices(10) }} />)
    const items = screen
      .getByText('Support levels')
      .closest('.metric-grid')
      ?.querySelectorAll('dd')
    expect(Array.from(items ?? []).map((dd) => dd.textContent)).toContain('none detected')
  })

  it('renders empty indicator and signal states defensively', () => {
    // Force the guarded empty-array paths the real engine never produces:
    // an empty moving-average array (the `last([])` guard) and an empty
    // signal set (the "no notable signals" empty state).
    vi.mocked(sma).mockReturnValue([])
    vi.mocked(signals).mockReturnValue([])
    render(<CompanyTechnicals company={company} />)
    expect(
      screen.getByText('No notable technical signals in this timeframe.'),
    ).toBeInTheDocument()
    // The moving-averages panel shows n/a for every unavailable SMA value.
    const smaValues = screen
      .getByText('SMA 20')
      .closest('.metric-grid')
      ?.querySelectorAll('dd')
    expect(Array.from(smaValues ?? []).every((dd) => dd.textContent === 'n/a')).toBe(true)
  })
})
