import type { AlertChannel, TriggeredAlert } from './types'
import { describeAlert } from './alerts'

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
  token?: string
}

/**
 * Alerts are delivered through a relay webhook (for example a serverless
 * function in front of SendGrid for email and Twilio for SMS/WhatsApp) so that
 * vendor credentials never ship in the browser bundle. Without a webhook the
 * app only lists the alerts in the UI.
 */
export function resolveNotifier(env: Record<string, string | undefined>): NotifierConfig | null {
  const url = env.VITE_ALERT_WEBHOOK_URL?.trim()
  if (!url) return null
  const token = env.VITE_ALERT_WEBHOOK_TOKEN?.trim()
  return token ? { url, token } : { url }
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.token) headers.Authorization = 'Bearer ' + config.token
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers,
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
