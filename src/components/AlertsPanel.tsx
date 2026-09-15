import { alertKey } from '../lib/notifications'
import { describeAlert } from '../lib/alerts'
import type { AlertDelivery } from '../lib/notifications'
import type { TriggeredAlert } from '../lib/types'

interface Props {
  alerts: TriggeredAlert[]
  deliveries?: Record<string, AlertDelivery>
}

const STATUS_LABELS = {
  sent: 'Sent',
  failed: 'Failed',
  skipped: 'In-app only',
} as const

export function AlertsPanel({ alerts, deliveries = {} }: Props) {
  return (
    <section className="card alerts" aria-labelledby="alerts-title">
      <h2 id="alerts-title">Triggered alerts</h2>
      {alerts.length === 0 ? (
        <p className="alerts__empty" data-testid="alerts-empty">
          No thresholds crossed right now.
        </p>
      ) : (
        <ul className="alerts__list">
          {alerts.map((alert) => {
            const delivery = deliveries[alertKey(alert)]
            return (
              <li
                key={`${alert.symbol}-${alert.direction}`}
                className={`alerts__item is-${alert.direction}`}
              >
                {describeAlert(alert)}
                {delivery ? (
                  <span
                    className={`alerts__status is-${delivery.status}`}
                    data-testid={`alert-status-${alert.symbol}`}
                    title={delivery.detail}
                  >
                    {STATUS_LABELS[delivery.status]}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
