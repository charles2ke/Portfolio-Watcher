import type { AlertChannel, TriggeredAlert } from './types'
import { describeAlert } from './alerts'
import { isSecureEndpoint } from './endpoints'

export type DeliveryStatus = 'sent' | 'failed' | 'skipped'

export interface AlertDelivery {
  key: string
  status: DeliveryStatus
  detail: string
}

export interface AlertPayload {
  symbol: string
  direction: 'dip' | 'rise'
  changePercent: number
  threshold: number
  channels: AlertChannel[]
  destinations: string[]
  message: string
  sentAt: string
}

export interface NotifierConfig {
  url: string
}

/**
 * Alerts are delivered through a relay webhook (for example a serverless
 * function in front of SendGrid for email and Twilio for SMS/WhatsApp) so that
 * vendor credentials never ship in the browser bundle. Without a webhook the
 * app only lists the alerts in the UI.
 *
 * Authentication and rate limiting for that relay must happen server-side
 * (for example an origin allow-list or a secret held only by the relay
 * itself) — anything shipped as a `VITE_` variable is public in the compiled
 * bundle and cannot act as an auth credential.
 */
export function resolveNotifier(env: Record<string, string | undefined>): NotifierConfig | null {
  const url = env.VITE_ALERT_WEBHOOK_URL?.trim()
  if (!url || !isSecureEndpoint(url)) return null
  return { url }
}

/** Stable identity of an alert so the same threshold crossing is sent once. */
export function alertKey(alert: TriggeredAlert): string {
  return `${alert.symbol}:${alert.direction}:${alert.threshold}`
}

export function buildAlertPayload(alert: TriggeredAlert, sentAt: string): AlertPayload {
  return {
    symbol: alert.symbol,
    direction: alert.direction,
    changePercent: alert.changePercent,
    threshold: alert.threshold,
    channels: alert.channels,
    destinations: alert.destinations,
    message: describeAlert(alert),
    sentAt,
  }
}

async function post(config: NotifierConfig, payload: AlertPayload): Promise<boolean> {
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Sends every alert that has not been delivered yet and reports the outcome per
 * alert so the UI can show what actually left the browser.
 */
export async function deliverAlerts(
  alerts: TriggeredAlert[],
  alreadySent: ReadonlySet<string>,
  env: Record<string, string | undefined>,
  now: () => string = () => new Date().toISOString(),
): Promise<AlertDelivery[]> {
  const config = resolveNotifier(env)
  const pending = alerts.filter((alert) => !alreadySent.has(alertKey(alert)))
  if (pending.length === 0) return []
  if (!config) {
    return pending.map((alert) => ({
      key: alertKey(alert),
      status: 'skipped' as const,
      detail: 'No alert webhook configured — showing in-app only.',
    }))
  }
  return Promise.all(
    pending.map(async (alert) => {
      const ok = await post(config, buildAlertPayload(alert, now()))
      return {
        key: alertKey(alert),
        status: ok ? ('sent' as const) : ('failed' as const),
        detail: ok
          ? `Delivered to ${alert.destinations.join(', ')}.`
          : 'Delivery failed — the relay did not accept the alert.',
      }
    }),
  )
}
