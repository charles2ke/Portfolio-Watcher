import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlobalSearch } from './GlobalSearch'

describe('GlobalSearch', () => {
  it('shows no results for an empty query', () => {
    render(<GlobalSearch onSelect={vi.fn()} />)
    expect(document.querySelector('.global-search__results')).toBeNull()
    expect(document.querySelector('.global-search__empty')).toBeNull()
  })

  it('lists matching securities and reports selection', async () => {
    const onSelect = vi.fn()
    render(<GlobalSearch onSelect={onSelect} />)
    const input = screen.getByRole('searchbox')
    await userEvent.type(input, 'ARCL')
    const result = screen.getByRole('button', { name: /ARCL/ })
    expect(result).toBeInTheDocument()
    await userEvent.click(result)
    expect(onSelect).toHaveBeenCalledWith('ARCL')
    expect(input).toHaveValue('')
  })

  it('shows an empty message for a non-matching query', async () => {
    render(<GlobalSearch onSelect={vi.fn()} />)
    await userEvent.type(screen.getByRole('searchbox'), 'zzzznomatch')
    expect(screen.getByText(/No security matches/)).toBeInTheDocument()
  })
})
