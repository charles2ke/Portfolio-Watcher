import { formatNumber } from '../format'
import type { MetricDefinition } from '../screener'

/** Formats a screener metric according to its declared unit. */
export function formatMetric(definition: MetricDefinition, value: number | null): string {
  if (value === null) return '—'
  if (definition.format === 'percent') return `${formatNumber(value * 100, 1)}%`
  if (definition.format === 'percent-points') return `${formatNumber(value, 1)}%`
  if (definition.format === 'currency-millions') return `${formatNumber(value, 0)}m`
  return formatNumber(value)
}
