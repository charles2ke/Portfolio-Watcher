import type { ReactNode } from 'react'
import { describeProvenance, freshnessDays, freshnessLabel } from '../format'
import type { Provenance } from '../types'

/** Small presentational building blocks shared by every research module. */

export function Panel({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel">
      <header className="panel__head">
        <div>
          <h3 className="panel__title">{title}</h3>
          {subtitle ? <p className="panel__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="panel__actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  )
}

export function MetricGrid({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className="metric-grid">
      {items.map((item) => (
        <div key={item.label} className="metric-grid__item">
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.hint ? <p className="metric-grid__hint">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  )
}

export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: { key: string; cells: ReactNode[] }[]
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={`${row.key}-${columns[index] ?? index}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty">No rows match the current selection.</p> : null}
    </div>
  )
}

export function ProvenanceNote({ sources, now }: { sources: Provenance[]; now?: Date }) {
  const reference = now ?? new Date()
  return (
    <ul className="provenance">
      {sources.map((source) => {
        const label = freshnessLabel(freshnessDays(source, reference))
        return (
          <li key={`${source.provider}-${source.source}-${source.asOf}`}>
            <span className={`provenance__badge is-${label}`}>{label}</span>
            {describeProvenance(source)}
          </li>
        )
      })}
    </ul>
  )
}

export function MissingData({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="missing" role="note">
      <p className="missing__title">Not available from the connected data sources</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/** Accessible line chart: an SVG polyline with a descriptive label. */
export function LineChart({
  series,
  label,
  positive = true,
  height = 80,
}: {
  series: number[]
  label: string
  positive?: boolean
  height?: number
}) {
  if (series.length === 0) return <p className="empty">{`${label}: no data available`}</p>
  const width = 320
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  const step = series.length > 1 ? width / (series.length - 1) : 0
  const points = series
    .map(
      (value, index) =>
        `${(index * step).toFixed(2)},${(height - ((value - min) / span) * height).toFixed(2)}`,
    )
    .join(' ')
  return (
    <svg
      className={`line-chart ${positive ? 'is-up' : 'is-down'}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}. Range ${min.toFixed(2)} to ${max.toFixed(2)}.`}
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" strokeWidth="2" />
    </svg>
  )
}

export function Tabs({
  tabs,
  active,
  onSelect,
  label,
}: {
  tabs: { id: string; label: string }[]
  active: string
  onSelect: (id: string) => void
  label: string
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`tab-${tab.id}`}
          aria-selected={tab.id === active}
          className={`tabs__tab ${tab.id === active ? 'is-active' : ''}`}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="disclaimer" role="note">
      {children}
    </p>
  )
}
