import type { AlertChannel, Quote, TriggeredAlert, Watch } from './types'

export const ALERT_CHANNELS: AlertChannel[] = ['email', 'sms', 'whatsapp']

export const CHANNEL_LABELS: Record<AlertChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_PATTERN = /^\+?[0-9][0-9\s\-()]{6,17}$/

export function needsEmail(channels: AlertChannel[]): boolean {
  return channels.includes('email')
}

export function needsPhone(channels: AlertChannel[]): boolean {
  return channels.includes('sms') || channels.includes('whatsapp')
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value.trim())
}

/** Every selected channel must have a usable destination. */
export function validateDestinations(
  channels: AlertChannel[],
  email: string,
  phone: string,
): string | null {
  if (needsEmail(channels) && !isValidEmail(email)) return 'Enter a valid email address.'
  if (needsPhone(channels) && !isValidPhone(phone)) {
    return 'Enter a valid phone number in international format, e.g. +15551234567.'
  }
  return null
}

/** The destinations that a watch notifies for its selected channels. */
export function destinationsFor(watch: Watch): string[] {
  const destinations: string[] = []
  if (needsEmail(watch.channels)) destinations.push(watch.email)
  if (needsPhone(watch.channels)) destinations.push(watch.phone)
  return destinations
}

/** Returns the alert that a quote triggers for a watch, if any. */
export function evaluateWatch(watch: Watch, quote: Quote): TriggeredAlert | null {
  const change = quote.changePercent
  const base = {
    symbol: quote.symbol,
    changePercent: change,
    channels: watch.channels,
    destinations: destinationsFor(watch),
  }
  if (watch.dipPercent > 0 && change <= -watch.dipPercent) {
    return { ...base, direction: 'dip', threshold: watch.dipPercent }
  }
  if (watch.risePercent > 0 && change >= watch.risePercent) {
    return { ...base, direction: 'rise', threshold: watch.risePercent }
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
  return `${alert.symbol} ${direction} ${Math.abs(alert.changePercent).toFixed(2)}% (threshold ${alert.threshold}%) — notifying ${alert.destinations.join(', ')} via ${channels}`
}
