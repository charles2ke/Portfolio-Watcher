import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { competitiveLandscape, type CompetitiveLandscape } from '../competition'
import { CompanyCompetition } from './CompanyCompetition'
import { getCompany } from '../universe'
import type { CompanyRecord } from '../types'

// Delegate to the real engine by default; individual tests override the return
// value to reach branches the bundled dataset cannot produce (null peer metric
// values and null moat scores never occur for real companies).
vi.mock('../competition', async (importActual) => {
  const actual = await importActual<typeof import('../competition')>()
  return { ...actual, competitiveLandscape: vi.fn(actual.competitiveLandscape) }
})

afterEach(() => {
  vi.mocked(competitiveLandscape).mockClear()
})

describe('CompanyCompetition', () => {
  it('renders peer comparison, market share and qualitative sections when available', () => {
    render(<CompanyCompetition company={getCompany('ARCL') as CompanyRecord} />)
    expect(screen.getByText('Peer comparison')).toBeInTheDocument()
    expect(screen.getByText('Competitive dimensions')).toBeInTheDocument()
    expect(screen.getByText('Market share trend')).toBeInTheDocument()
    // ARCL carries sourced narrative, so the qualitative list is rendered.
    expect(screen.getByText('Innovation pipeline')).toBeInTheDocument()
    // The market-share list shows concrete percentages for a company with data.
    expect(screen.getAllByText(/2024:/).length).toBeGreaterThan(0)
  })

  it('shows the missing market-share message for a company without data', () => {
    render(<CompanyCompetition company={getCompany('MDCR') as CompanyRecord} />)
    expect(
      screen.getByText(/No reliable market-share data is connected for MDCR/),
    ).toBeInTheDocument()
  })

  it('shows the not-available message when qualitative commentary is missing', () => {
    render(<CompanyCompetition company={getCompany('ZPHR') as CompanyRecord} />)
    const notAvailable = screen.getAllByText('Not available in the connected data sources')
    expect(notAvailable.length).toBeGreaterThan(0)
  })

  it('renders nothing for a ticker outside the universe', () => {
    const { container } = render(
      <CompanyCompetition company={{ security: { ticker: 'ZZZZ' } } as CompanyRecord} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders not-available cells for null peer values and null moat scores', () => {
    const base = getCompany('ARCL') as CompanyRecord
    const peer = getCompany('NBLA') as CompanyRecord
    const landscape: CompetitiveLandscape = {
      company: base,
      peers: [peer],
      table: [
        {
          metric: 'Market cap',
          unit: 'currency-millions',
          values: [
            { ticker: 'ARCL', value: 1000 },
            { ticker: 'NBLA', value: null },
          ],
        },
        {
          metric: 'Gross margin',
          unit: 'percent',
          values: [
            { ticker: 'ARCL', value: 55 },
            { ticker: 'NBLA', value: 40 },
          ],
        },
        {
          metric: 'EV/EBITDA',
          unit: 'ratio',
          values: [
            { ticker: 'ARCL', value: 12 },
            { ticker: 'NBLA', value: 9 },
          ],
        },
      ],
      moat: [
        {
          dimension: 'Brand',
          values: [
            { ticker: 'ARCL', score: 5 },
            { ticker: 'NBLA', score: null },
          ],
        },
      ],
      marketShare: [
        { ticker: 'ARCL', points: [{ year: 2024, sharePercent: 14 }] },
        { ticker: 'NBLA', points: null },
      ],
      qualitative: [
        { title: 'Innovation pipeline', items: ['Sample innovation note.'], available: true },
        { title: 'Industry threats', items: [], available: false },
      ],
    }
    vi.mocked(competitiveLandscape).mockReturnValueOnce(landscape)

    render(<CompanyCompetition company={base} />)
    // NULL peer value (currency), null moat score and missing narrative all
    // render the explicit "Not available" marker.
    expect(screen.getAllByText('Not available in the connected data sources').length).toBe(3)
    // The formatted, non-null cells cover the percent/currency/ratio units.
    expect(screen.getByText('1,000m')).toBeInTheDocument()
    expect(screen.getByText('40.0%')).toBeInTheDocument()
    expect(screen.getByText('9.00')).toBeInTheDocument()
  })
})
