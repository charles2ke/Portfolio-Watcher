import { afterEach, describe, expect, it, vi } from 'vitest'
import { alertKey, buildAlertPayload, deliverAlerts, resolveNotifier } from './notifications'
import type { TriggeredAlert } from './types'

const alert: TriggeredAlert = {
  symbol: 'MSFT',
  direction: 'dip',
  changePercent: -6,
  threshold: 5,
  channels: ['email'],
  destinations: ['trader@example.com'],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('resolveNotifier', () => {
  it('returns null without a webhook', () => {
    expect(resolveNotifier({})).toBeNull()
    expect(resolveNotifier({ VITE_ALERT_WEBHOOK_URL: '  ' })).toBeNull()
  })

  it('refuses a webhook that is not https', () => {
    expect(resolveNotifier({ VITE_ALERT_WEBHOOK_URL: 'http://relay.example/alerts' })).toBeNull()
  })

  it('reads the webhook, trimmed', () => {
    expect(resolveNotifier({ VITE_ALERT_WEBHOOK_URL: ' https://relay.example/alerts ' })).toEqual({
      url: 'https://relay.example/alerts',
    })
  })
})

describe('alert payloads', () => {
  it('builds a stable key', () => {
    expect(alertKey(alert)).toBe('MSFT:dip:5')
  })

  it('includes a human readable message', () => {
    const payload = buildAlertPayload(alert, '2024-01-02T00:00:00.000Z')
    expect(payload.message).toContain('MSFT dropped 6.00%')
    expect(payload.sentAt).toBe('2024-01-02T00:00:00.000Z')
    expect(payload.destinations).toEqual(['trader@example.com'])
  })
})

describe('deliverAlerts', () => {
  const env = { VITE_ALERT_WEBHOOK_URL: 'https://relay.example/alerts' }

  it('does nothing when every alert was already sent', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await deliverAlerts([alert], new Set([alertKey(alert)]), env)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips delivery when no webhook is configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const results = await deliverAlerts([alert], new Set(), {})
    expect(results).toEqual([
      {
        key: 'MSFT:dip:5',
        status: 'skipped',
        detail: 'No alert webhook configured — showing in-app only.',
      },
    ])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('posts pending alerts to the relay', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const results = await deliverAlerts([alert], new Set(), env, () => '2024-01-02T00:00:00.000Z')
    expect(results[0]).toMatchObject({ key: 'MSFT:dip:5', status: 'sent' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://relay.example/alerts')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init.body))).toMatchObject({ symbol: 'MSFT', direction: 'dip' })
  })

  it('uses the current time by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const results = await deliverAlerts([alert], new Set(), env)
    expect(results[0].status).toBe('sent')
  })

  it('reports rejected and failed deliveries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect((await deliverAlerts([alert], new Set(), env))[0]).toMatchObject({ status: 'failed' })

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect((await deliverAlerts([alert], new Set(), env))[0]).toMatchObject({ status: 'failed' })
  })
})
