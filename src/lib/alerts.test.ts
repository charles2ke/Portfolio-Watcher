import { describe, expect, it } from 'vitest'
import {
  ALERT_CHANNELS,
  CHANNEL_LABELS,
  describeAlert,
  destinationsFor,
  evaluateWatch,
  evaluateWatches,
  isValidEmail,
  isValidPhone,
  needsEmail,
  needsPhone,
  validateDestinations,
} from './alerts'
import type { Quote, Watch } from './types'

const watch = (overrides: Partial<Watch> = {}): Watch => ({
  id: '1',
  symbol: 'MSFT',
  dipPercent: 5,
  risePercent: 5,
  channels: ['email'],
  email: 'me@example.com',
  phone: '+15551234567',
  ...overrides,
})

const quote = (changePercent: number): Quote => ({
  symbol: 'MSFT',
  price: 100,
  previousClose: 100,
  changePercent,
  currency: 'USD',
  series: [100, 100],
})

describe('channels', () => {
  it('exposes all supported channels', () => {
    expect(ALERT_CHANNELS).toEqual(['email', 'sms', 'whatsapp'])
    expect(CHANNEL_LABELS.whatsapp).toBe('WhatsApp')
  })

  it('knows which destinations a channel selection needs', () => {
    expect(needsEmail(['email'])).toBe(true)
    expect(needsEmail(['sms'])).toBe(false)
    expect(needsPhone(['sms'])).toBe(true)
    expect(needsPhone(['whatsapp'])).toBe(true)
    expect(needsPhone(['email'])).toBe(false)
  })

  it('validates emails and phone numbers', () => {
    expect(isValidEmail(' me@example.com ')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidPhone(' +15551234567 ')).toBe(true)
    expect(isValidPhone('12345')).toBe(false)
  })

  it('validates the destinations required by the selected channels', () => {
    expect(validateDestinations([], '', '')).toBeNull()
    expect(validateDestinations(['email'], 'nope', '')).toMatch(/email address/)
    expect(validateDestinations(['sms'], '', '123')).toMatch(/phone number/)
    expect(validateDestinations(['email'], 'me@example.com', '')).toBeNull()
    expect(
      validateDestinations(['email', 'whatsapp'], 'me@example.com', '+15551234567'),
    ).toBeNull()
  })

  it('lists the destinations used by a watch', () => {
    expect(destinationsFor(watch())).toEqual(['me@example.com'])
    expect(destinationsFor(watch({ channels: ['sms'] }))).toEqual(['+15551234567'])
    expect(destinationsFor(watch({ channels: ['email', 'whatsapp'] }))).toEqual([
      'me@example.com',
      '+15551234567',
    ])
  })
})

describe('evaluateWatch', () => {
  it('triggers a dip alert', () => {
    expect(evaluateWatch(watch(), quote(-6))?.direction).toBe('dip')
  })

  it('triggers a rise alert', () => {
    expect(evaluateWatch(watch(), quote(7))?.direction).toBe('rise')
  })

  it('stays quiet inside the thresholds', () => {
    expect(evaluateWatch(watch(), quote(1))).toBeNull()
  })

  it('ignores disabled thresholds', () => {
    expect(evaluateWatch(watch({ dipPercent: 0 }), quote(-40))).toBeNull()
    expect(evaluateWatch(watch({ risePercent: 0 }), quote(40))).toBeNull()
  })
})

describe('evaluateWatches', () => {
  it('collects alerts and skips symbols without quotes', () => {
    const alerts = evaluateWatches(
      [watch(), watch({ id: '2', symbol: 'AAPL' }), watch({ id: '3', symbol: 'TSLA' })],
      { MSFT: quote(-9), AAPL: quote(0) },
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].symbol).toBe('MSFT')
  })
})

describe('describeAlert', () => {
  it('describes dips and rises', () => {
    const dip = evaluateWatch(watch({ channels: ['email', 'whatsapp'] }), quote(-8.5))!
    expect(describeAlert(dip)).toBe(
      'MSFT dropped 8.50% (threshold 5%) — notifying me@example.com, +15551234567 via Email, WhatsApp',
    )
    const rise = evaluateWatch(watch(), quote(8.5))!
    expect(describeAlert(rise)).toContain('gained 8.50%')
  })
})
