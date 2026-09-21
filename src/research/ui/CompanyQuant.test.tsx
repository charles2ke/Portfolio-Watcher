import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanyQuant } from './CompanyQuant'
import { getCompany } from '../universe'
import type { CompanyRecord, PricePoint } from '../types'

// AQFL has no listed options, so ownership signals include a null-valued row.
const company = getCompany('AQFL') as CompanyRecord

// A short, single-month history: the traded month yields a statistically
// significant bucket while the other eleven months have no observations, so the
// table exercises both the null/non-null t-stat and significant/insignificant
// branches of statRows.
function marchPrices(): PricePoint[] {
  const points: PricePoint[] = []
  let close = 100
  for (let day = 1; day <= 30; day += 1) {
    close += 1 + (day % 2)
    points.push({
      date: `2025-03-${String(day).padStart(2, '0')}`,
      high: close,
      low: close,
      close,
      volume: 1_000_000,
    })
  }
  return points
}

describe('CompanyQuant', () => {
  it('renders the return profile and seasonality tables', () => {
    render(<CompanyQuant company={company} />)
    expect(screen.getByRole('heading', { name: 'Return profile' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Monthly seasonality' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Day-of-week seasonality' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Relative performance' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Positioning signals' })).toBeInTheDocument()
    // The options-implied move row is null for a company without options.
    expect(screen.getByText('Options-implied move')).toBeInTheDocument()
  })

  it('switches the analysis period', async () => {
    render(<CompanyQuant company={company} />)
    const select = screen.getByLabelText('Analysis period')
    await userEvent.selectOptions(select, '252')
    expect((select as HTMLSelectElement).value).toBe('252')
    await userEvent.selectOptions(select, '504')
    expect((select as HTMLSelectElement).value).toBe('504')
  })

  it('switches between earnings and macro event sets', async () => {
    render(<CompanyQuant company={company} />)
    const select = screen.getByLabelText('Event set')
    expect((select as HTMLSelectElement).value).toBe('earnings')
    await userEvent.selectOptions(select, 'macro')
    expect((select as HTMLSelectElement).value).toBe('macro')
    await userEvent.selectOptions(select, 'earnings')
    expect((select as HTMLSelectElement).value).toBe('earnings')
  })

  it('shows null and non-null t-stats and both significance verdicts', () => {
    render(<CompanyQuant company={{ ...company, prices: marchPrices() }} />)
    // Empty month buckets render the "Not available" t-stat and the
    // "not statistically significant" verdict...
    expect(
      screen.getAllByText('Not available in the connected data sources').length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('not statistically significant').length).toBeGreaterThan(0)
    // ...while the single traded month is statistically significant.
    expect(screen.getAllByText('significant at 95%').length).toBeGreaterThan(0)
  })
})
