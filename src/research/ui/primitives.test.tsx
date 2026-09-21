import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  DataTable,
  Disclaimer,
  LineChart,
  MetricGrid,
  MissingData,
  Panel,
  ProvenanceNote,
  Tabs,
} from './primitives'
import { MODULES } from './modules'
import { formatMetric } from './metricFormat'
import { assetClassFor } from './assetClass'
import type { MetricDefinition } from '../screener'
import type { Holding } from '../risk'
import type { Provenance } from '../types'

function provenance(asOf: string): Provenance {
  return {
    provider: 'Sample provider',
    source: 'sample-source',
    asOf,
    retrievedAt: `${asOf}T21:05:00.000Z`,
    currency: 'USD',
  }
}

function holding(overrides: Partial<Holding>): Holding {
  return {
    ticker: 'ARCL',
    quantity: 1,
    price: 1,
    value: 1,
    weight: 1,
    sector: 'Technology',
    country: 'United States',
    currency: 'USD',
    beta: 1,
    ...overrides,
  }
}

describe('Panel', () => {
  it('renders subtitle and actions when provided', () => {
    render(
      <Panel title="Title" subtitle="Subtitle" actions={<button type="button">Do</button>}>
        <p>Body</p>
      </Panel>,
    )
    expect(screen.getByText('Subtitle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Do' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('omits subtitle and actions when absent', () => {
    render(
      <Panel title="Bare">
        <p>Body</p>
      </Panel>,
    )
    expect(screen.queryByText('Subtitle')).toBeNull()
    expect(document.querySelector('.panel__actions')).toBeNull()
    expect(document.querySelector('.panel__subtitle')).toBeNull()
  })
})

describe('MetricGrid', () => {
  it('renders hints when present and skips them when absent', () => {
    render(
      <MetricGrid
        items={[
          { label: 'With hint', value: '1', hint: 'a hint' },
          { label: 'No hint', value: '2' },
        ]}
      />,
    )
    expect(screen.getByText('a hint')).toBeInTheDocument()
    expect(document.querySelectorAll('.metric-grid__hint')).toHaveLength(1)
  })
})

describe('DataTable', () => {
  it('renders rows', () => {
    render(
      <DataTable
        caption="Cap"
        columns={['A', 'B']}
        rows={[{ key: 'r1', cells: ['x', 'y', 'extra'] }]}
      />,
    )
    expect(screen.getByText('x')).toBeInTheDocument()
    expect(screen.getByText('extra')).toBeInTheDocument()
    expect(screen.queryByText('No rows match the current selection.')).toBeNull()
  })

  it('shows an empty message with zero rows', () => {
    render(<DataTable caption="Cap" columns={['A']} rows={[]} />)
    expect(screen.getByText('No rows match the current selection.')).toBeInTheDocument()
  })
})

describe('ProvenanceNote', () => {
  it('labels sources by freshness with an explicit now', () => {
    render(
      <ProvenanceNote
        sources={[provenance('2026-01-10'), provenance('2026-01-05'), provenance('2025-12-01')]}
        now={new Date('2026-01-10T12:00:00.000Z')}
      />,
    )
    expect(document.querySelector('.provenance__badge.is-live')).toBeInTheDocument()
    expect(document.querySelector('.provenance__badge.is-recent')).toBeInTheDocument()
    expect(document.querySelector('.provenance__badge.is-stale')).toBeInTheDocument()
  })

  it('falls back to the current date without an explicit now', () => {
    render(<ProvenanceNote sources={[provenance('2000-01-01')]} />)
    expect(document.querySelector('.provenance__badge.is-stale')).toBeInTheDocument()
  })
})

describe('MissingData', () => {
  it('returns nothing when empty', () => {
    const { container } = render(<MissingData items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('lists missing items when populated', () => {
    render(<MissingData items={['One', 'Two']} />)
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})

describe('LineChart', () => {
  it('renders an empty state for no data', () => {
    render(<LineChart series={[]} label="Empty" />)
    expect(screen.getByText('Empty: no data available')).toBeInTheDocument()
  })

  it('renders a single-point series', () => {
    render(<LineChart series={[5]} label="Single" />)
    const svg = screen.getByRole('img', { name: /Single/ })
    expect(svg).toHaveClass('is-up')
    expect(svg.querySelector('polyline')?.getAttribute('points')).toBe('0.00,80.00')
  })

  it('renders a flat series where min equals max', () => {
    render(<LineChart series={[3, 3, 3]} label="Flat" positive={false} height={40} />)
    const svg = screen.getByRole('img', { name: /Flat/ })
    expect(svg).toHaveClass('is-down')
    expect(svg.querySelector('polyline')?.getAttribute('points')).toBe('0.00,40.00 160.00,40.00 320.00,40.00')
  })

  it('renders a rising multi-point series', () => {
    render(<LineChart series={[1, 2, 3]} label="Up" />)
    const svg = screen.getByRole('img', { name: 'Up. Range 1.00 to 3.00.' })
    expect(svg).toHaveClass('is-up')
  })
})

describe('Tabs', () => {
  it('marks the active tab and reports selection', async () => {
    const onSelect = vi.fn()
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
        ]}
        active="a"
        onSelect={onSelect}
        label="Sections"
      />,
    )
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })
})

describe('Disclaimer', () => {
  it('renders its children in a note', () => {
    render(<Disclaimer>Careful</Disclaimer>)
    expect(screen.getByRole('note')).toHaveTextContent('Careful')
  })
})

describe('MODULES', () => {
  it('lists the navigation modules', () => {
    expect(MODULES.map((module) => module.id)).toContain('dashboard')
    expect(MODULES).toHaveLength(9)
  })
})

describe('formatMetric', () => {
  const definition = (format: MetricDefinition['format']): MetricDefinition => ({
    key: 'marketCap',
    label: 'Market cap',
    format,
    min: 0,
    max: 1,
    step: 1,
  })

  it('formats every unit and null', () => {
    expect(formatMetric(definition('percent'), null)).toBe('—')
    expect(formatMetric(definition('percent'), 0.1234)).toBe('12.3%')
    expect(formatMetric(definition('percent-points'), 4.25)).toBe('4.3%')
    expect(formatMetric(definition('currency-millions'), 1234.5)).toBe('1,235m')
    expect(formatMetric(definition('ratio'), 12.5)).toBe('12.50')
  })
})

describe('assetClassFor', () => {
  it('maps holdings onto asset classes', () => {
    expect(assetClassFor(holding({ ticker: 'CASH' }))).toBe('cash')
    expect(assetClassFor(holding({ sector: 'Real Estate' }))).toBe('reits')
    expect(assetClassFor(holding({ sector: 'Energy' }))).toBe('commodities')
    expect(assetClassFor(holding({ sector: 'Materials' }))).toBe('commodities')
    expect(assetClassFor(holding({ country: 'United States' }))).toBe('domestic-equity')
    expect(assetClassFor(holding({ country: 'Germany' }))).toBe('international-equity')
  })
})
