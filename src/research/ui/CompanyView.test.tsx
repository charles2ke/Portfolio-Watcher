import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanyView } from './CompanyView'
import { CompanyOverview } from './CompanyOverview'
import { CompanyEarnings } from './CompanyEarnings'
import { getCompany } from '../universe'
import { analyseEarnings, type EarningsAnalysis } from '../earnings'
import { NOT_AVAILABLE } from '../format'
import type { CompanyRecord, ResearchWatchlist } from '../types'

vi.mock('../universe', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../universe')>()
  return { ...actual, getCompany: vi.fn(actual.getCompany) }
})

vi.mock('../earnings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../earnings')>()
  return { ...actual, analyseEarnings: vi.fn(actual.analyseEarnings) }
})

let realGetCompany: typeof getCompany

beforeEach(async () => {
  const universe = await vi.importActual<typeof import('../universe')>('../universe')
  const earnings = await vi.importActual<typeof import('../earnings')>('../earnings')
  realGetCompany = universe.getCompany
  vi.mocked(getCompany).mockImplementation(universe.getCompany)
  vi.mocked(analyseEarnings).mockImplementation(earnings.analyseEarnings)
})

const watchlists: ResearchWatchlist[] = [{ id: 'wl1', name: 'Research ideas', tickers: [] }]

function renderCompany(ticker: string | null, lists: ResearchWatchlist[] = watchlists) {
  const onAddToWatchlist = vi.fn()
  const onSaveReport = vi.fn()
  render(
    <CompanyView
      ticker={ticker}
      watchlists={lists}
      onAddToWatchlist={onAddToWatchlist}
      onSaveReport={onSaveReport}
    />,
  )
  return { onAddToWatchlist, onSaveReport }
}

describe('CompanyView', () => {
  it('shows the empty state when the ticker is null', () => {
    renderCompany(null)
    expect(screen.getByText('Search for a company above to open its research workspace.')).toBeInTheDocument()
  })

  it('shows the empty state for an unknown ticker', () => {
    renderCompany('NOPE')
    expect(screen.getByText('Search for a company above to open its research workspace.')).toBeInTheDocument()
  })

  it('hides the watchlist action when there are no watchlists', () => {
    renderCompany('ARCL', [])
    expect(screen.queryByRole('button', { name: /Add to/ })).toBeNull()
  })

  it('adds the company to the first watchlist', async () => {
    const { onAddToWatchlist } = renderCompany('ARCL')
    await userEvent.click(screen.getByRole('button', { name: 'Add to Research ideas' }))
    expect(onAddToWatchlist).toHaveBeenCalledWith('wl1', 'ARCL')
  })

  it('renders every tab for a company with options and insiders', async () => {
    const { onSaveReport } = renderCompany('ARCL')
    expect(screen.getByText('Key figures')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Financials' }))
    expect(screen.getByText('Financial summary')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Valuation' }))
    expect(screen.getByText('Assumptions')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save DCF as report' }))
    expect(onSaveReport).toHaveBeenCalledWith(
      'DCF valuation',
      'ARCL',
      expect.any(Object),
      expect.any(Object),
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Earnings' }))
    expect(screen.getByText('Earnings history')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Technicals' }))
    expect(screen.getByRole('tab', { name: 'Technicals' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: 'Quant' }))
    expect(screen.getByRole('tab', { name: 'Quant' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: 'Competition' }))
    expect(screen.getByRole('tab', { name: 'Competition' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: 'Dividends' }))
    expect(screen.getByRole('tab', { name: 'Dividends' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(screen.getByRole('tab', { name: 'Ownership' }))
    expect(screen.getByText('Options snapshot')).toBeInTheDocument()
    expect(screen.getByText('Recent insider transactions')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'News' }))
    expect(screen.getByText(/No news provider is connected/)).toBeInTheDocument()
  })

  it('surfaces missing data in the overview for a sparse company', () => {
    renderCompany('HLVT')
    expect(screen.getByText('Not available from the connected data sources')).toBeInTheDocument()
  })

  it('handles a company without options and without insiders', async () => {
    const base = realGetCompany('HLVT')
    if (!base) throw new Error('HLVT missing')
    vi.mocked(getCompany).mockReturnValue({ ...base, insiders: [] })
    renderCompany('HLVT')
    await userEvent.click(screen.getByRole('tab', { name: 'Ownership' }))
    expect(screen.getByText('No options data is connected for this security.')).toBeInTheDocument()
    expect(screen.getByText(NOT_AVAILABLE)).toBeInTheDocument()
  })
})

describe('CompanyOverview', () => {
  it('renders nothing when the company is not grounded', () => {
    const base = realGetCompany('ARCL')
    if (!base) throw new Error('ARCL missing')
    const fake: CompanyRecord = { ...base, security: { ...base.security, ticker: 'ZZZZ' } }
    const { container } = render(<CompanyOverview company={fake} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('CompanyEarnings', () => {
  function company(): CompanyRecord {
    const base = realGetCompany('ARCL')
    if (!base) throw new Error('ARCL missing')
    return base
  }

  const analysis: EarningsAnalysis = {
    ticker: 'ARCL',
    nextEarningsDate: '2026-10-22',
    quarters: [
      {
        period: 'Q1 2026',
        reportDate: '2026-01-15',
        epsReported: 1.2,
        epsConsensus: 1.1,
        revenueReported: 1000,
        revenueConsensus: 950,
        priceReactionPercent: 3,
        epsSurprisePercent: 9,
        revenueSurprisePercent: 5,
      },
    ],
    averageEpsSurprisePercent: 9,
    beatRatePercent: 100,
    averageAbsoluteReactionPercent: 3,
    kpis: [],
    guidance: [],
    impliedMovePercent: null,
    scenarios: [
      { name: 'base', epsEstimate: 1.2, revenueEstimate: 1000, priceReactionPercent: 0, rationale: 'flat' },
    ],
  }

  it('renders nothing when there is no analysis', () => {
    vi.mocked(analyseEarnings).mockReturnValue(null)
    const { container } = render(<CompanyEarnings company={company()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the market-implied move when options are connected', () => {
    render(<CompanyEarnings company={company()} />)
    expect(screen.getByText('Market-implied move')).toBeInTheDocument()
    expect(screen.getByText('From the at-the-money straddle in the connected options snapshot.')).toBeInTheDocument()
  })

  it('shows empty KPI and guidance states', () => {
    vi.mocked(analyseEarnings).mockReturnValue(analysis)
    render(<CompanyEarnings company={company()} />)
    expect(screen.getByText('No reliable options data is connected for this security.')).toBeInTheDocument()
    expect(screen.getAllByText(NOT_AVAILABLE).length).toBeGreaterThan(0)
  })

  it('marks guidance without a consensus figure', () => {
    vi.mocked(analyseEarnings).mockReturnValue({
      ...analysis,
      kpis: [{ label: 'Bookings', value: 120, unit: 'USD m', period: 'Q2 2026' }],
      guidance: [
        {
          metric: 'Revenue',
          low: 100,
          high: 120,
          consensus: null,
          unit: 'USD m',
          midpoint: 110,
          versusConsensusPercent: null,
          verdict: 'unknown',
        },
      ],
    })
    render(<CompanyEarnings company={company()} />)
    expect(screen.getByText('Company specific key performance indicators')).toBeInTheDocument()
    expect(screen.getByText('Management guidance compared with consensus')).toBeInTheDocument()
  })
})
