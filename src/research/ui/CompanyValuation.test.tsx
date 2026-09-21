import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CompanyValuation } from './CompanyValuation'
import { getCompany } from '../universe'
import type { CompanyRecord } from '../types'

function company(): CompanyRecord {
  const record = getCompany('ARCL')
  if (!record) throw new Error('ARCL missing from universe')
  return record
}

function renderValuation() {
  const onSaveReport = vi.fn()
  render(<CompanyValuation company={company()} onSaveReport={onSaveReport} />)
  return { onSaveReport }
}

describe('CompanyValuation', () => {
  it('edits every kind of assumption input', () => {
    renderValuation()
    fireEvent.change(screen.getByLabelText('Revenue (m)'), { target: { value: '30000' } })
    expect(screen.getByLabelText('Revenue (m)')).toHaveValue(30000)
    fireEvent.change(screen.getByLabelText('Operating margin'), { target: { value: '0.35' } })
    expect(screen.getByLabelText('Operating margin')).toHaveValue(0.35)
    fireEvent.change(screen.getByLabelText('WACC'), { target: { value: '0.09' } })
    expect(screen.getByLabelText('WACC')).toHaveValue(0.09)
    fireEvent.change(screen.getByLabelText('Diluted shares (m)'), { target: { value: '1300' } })
    expect(screen.getByLabelText('Diluted shares (m)')).toHaveValue(1300)
  })

  it('edits a per-year revenue growth input', () => {
    renderValuation()
    const firstGrowth = screen.getByLabelText('Year 1 revenue growth')
    fireEvent.change(firstGrowth, { target: { value: '0.2' } })
    expect(firstGrowth).toHaveValue(0.2)
  })

  it('switches the terminal-value method', async () => {
    renderValuation()
    const method = screen.getByLabelText('Terminal value method')
    await userEvent.selectOptions(method, 'Exit multiple')
    expect(method).toHaveValue('exit-multiple')
    expect(screen.getByText('Terminal value method: exit-multiple')).toBeInTheDocument()
  })

  it('saves a report and shows the confirmation status', async () => {
    const { onSaveReport } = renderValuation()
    await userEvent.click(screen.getByRole('button', { name: 'Save DCF as report' }))
    expect(onSaveReport).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('DCF report saved')
  })

  it('warns when the value per share is undefined', () => {
    renderValuation()
    fireEvent.change(screen.getByLabelText('WACC'), { target: { value: '0.01' } })
    expect(
      screen.getByText('Terminal value is undefined because WACC is not above the terminal growth rate. Adjust the assumptions.', {
        exact: false,
      }),
    ).toBeInTheDocument()
  })
})
