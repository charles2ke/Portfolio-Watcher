import { describeAlert } from '../lib/alerts'
import type { TriggeredAlert } from '../lib/types'

interface Props {
  alerts: TriggeredAlert[]
}

export function AlertsPanel({ alerts }: Props) {
  return (
    <section className="card alerts" aria-labelledby="alerts-title">
      <h2 id="alerts-title">Triggered alerts</h2>
      {alerts.length === 0 ? (
        <p className="alerts__empty" data-testid="alerts-empty">
          No thresholds crossed right now.
        </p>
      ) : (
        <ul className="alerts__list">
          {alerts.map((alert) => (
            <li key={`${alert.symbol}-${alert.direction}`} className={`alerts__item is-${alert.direction}`}>
              {describeAlert(alert)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
