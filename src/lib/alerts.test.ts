import { describe, expect, it } from 'vitest'
import {
  ALERT_CHANNELS,
  CHANNEL_LABELS,
  describeAlert,
  destinationHint,
  evaluateWatch,
  evaluateWatches,
  isValidDestination,
} from './alerts'
import type { Quote, Watch } from './types'

const watch = (overrides: Partial<Watch> = {}): Watch => ({
  id: '1',
  symbol: 'MSFT',
  dipPercent: 5,
  risePercent: 5,
  channels: ['email'],
  destination: 'me@example.com',
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

  it('validates destinations per channel', () => {
    expect(isValidDestination([], 'me@example.com')).toBe(false)
    expect(isValidDestination(['email'], '  ')).toBe(false)
    expect(isValidDestination(['email'], 'nope')).toBe(false)
    expect(isValidDestination(['email'], 'me@example.com')).toBe(true)
    expect(isValidDestination(['sms'], '+15551234567')).toBe(true)
    expect(isValidDestination(['whatsapp'], '12345')).toBe(false)
    expect(isValidDestination(['sms', 'whatsapp'], '+15551234567')).toBe(true)
  })

  it('hints at the expected destination format', () => {
    expect(destinationHint(['email', 'sms'])).toBe('you@example.com')
    expect(destinationHint(['sms'])).toBe('+15551234567')
    expect(destinationHint([])).toBe('Select at least one alert channel')
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
      'MSFT dropped 8.50% (threshold 5%) — notifying me@example.com via Email, WhatsApp',
    )
    const rise = evaluateWatch(watch(), quote(8.5))!
    expect(describeAlert(rise)).toContain('gained 8.50%')
  })
})
