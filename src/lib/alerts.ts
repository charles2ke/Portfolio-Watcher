import type { AlertChannel, Quote, TriggeredAlert, Watch } from './types'

export const ALERT_CHANNELS: AlertChannel[] = ['email', 'sms', 'whatsapp']

export const CHANNEL_LABELS: Record<AlertChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^\+?[0-9][0-9\s\-()]{6,17}$/

export function isValidDestination(channels: AlertChannel[], destination: string): boolean {
  const value = destination.trim()
  if (channels.length === 0) return false
  if (value === '') return false
  if (channels.includes('email') && !EMAIL_PATTERN.test(value)) return false
  if ((channels.includes('sms') || channels.includes('whatsapp')) && !PHONE_PATTERN.test(value)) {
    return false
  }
  return true
}

export function destinationHint(channels: AlertChannel[]): string {
  if (channels.includes('email')) return 'you@example.com'
  if (channels.length > 0) return '+15551234567'
  return 'Select at least one alert channel'
}

/** Returns the alert that a quote triggers for a watch, if any. */
export function evaluateWatch(watch: Watch, quote: Quote): TriggeredAlert | null {
  const change = quote.changePercent
  if (watch.dipPercent > 0 && change <= -watch.dipPercent) {
    return {
      symbol: quote.symbol,
      direction: 'dip',
      changePercent: change,
      threshold: watch.dipPercent,
      channels: watch.channels,
      destination: watch.destination,
    }
  }
  if (watch.risePercent > 0 && change >= watch.risePercent) {
    return {
      symbol: quote.symbol,
      direction: 'rise',
      changePercent: change,
      threshold: watch.risePercent,
      channels: watch.channels,
      destination: watch.destination,
    }
  }
  return null
}

export function evaluateWatches(
  watches: Watch[],
  quotes: Record<string, Quote | undefined>,
): TriggeredAlert[] {
  const alerts: TriggeredAlert[] = []
  for (const watch of watches) {
    const quote = quotes[watch.symbol]
    if (!quote) continue
    const alert = evaluateWatch(watch, quote)
    if (alert) alerts.push(alert)
  }
  return alerts
}

export function describeAlert(alert: TriggeredAlert): string {
  const direction = alert.direction === 'dip' ? 'dropped' : 'gained'
  const channels = alert.channels.map((channel) => CHANNEL_LABELS[channel]).join(', ')
  return `${alert.symbol} ${direction} ${Math.abs(alert.changePercent).toFixed(2)}% (threshold ${alert.threshold}%) — notifying ${alert.destination} via ${channels}`
}
