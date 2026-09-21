import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanyDividends } from './CompanyDividends'
import { getCompany } from '../universe'
import type { CompanyRecord } from '../types'

describe('CompanyDividends', () => {
  it('shows the no-dividend panel for a non-payer', () => {
    render(<CompanyDividends company={getCompany('NBLA') as CompanyRecord} />)
    expect(screen.getByText(/does not pay a dividend/)).toBeInTheDocument()
  })

  it('renders a long-history payer with all CAGR values and no recorded cut', () => {
    // AQFL has 21 consecutive growth years (all CAGRs) and no dividend cut.
    render(<CompanyDividends company={getCompany('AQFL') as CompanyRecord} />)
    expect(screen.getByText('Dividend profile')).toBeInTheDocument()
    expect(screen.getByText('No recorded cut')).toBeInTheDocument()
    expect(screen.getByText('3-year CAGR')).toBeInTheDocument()
    // None of the CAGR rows should be "Not available".
    expect(screen.queryByText('Not available in the connected data sources')).toBeNull()
  })

  it('renders a payer with null CAGRs and a recorded cut, and drives the DRIP simulator', async () => {
    // BRTN has 0 growth years (all CAGRs null) and a cut recorded in 2022.
    render(<CompanyDividends company={getCompany('BRTN') as CompanyRecord} />)
    expect(screen.getByText('2022')).toBeInTheDocument()
    expect(screen.getAllByText('Not available in the connected data sources').length).toBe(3)

    fireEvent.change(screen.getByLabelText('Initial investment'), { target: { value: '25000' } })
    fireEvent.change(screen.getByLabelText('Annual contribution'), { target: { value: '3600' } })
    fireEvent.change(screen.getByLabelText('Dividend growth'), { target: { value: '0.08' } })
    fireEvent.change(screen.getByLabelText('Price growth'), { target: { value: '0.04' } })
    fireEvent.change(screen.getByLabelText('Projection horizon (years)'), { target: { value: '15' } })

    const reinvest = screen.getByLabelText('Reinvest dividends')
    expect(reinvest).toBeChecked()
    await userEvent.click(reinvest)
    expect(reinvest).not.toBeChecked()

    expect(screen.getByText('DRIP simulator')).toBeInTheDocument()
  })
})
