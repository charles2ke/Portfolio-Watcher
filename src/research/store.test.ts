import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_PROFILE,
  RESEARCH_KEYS,
  defaultPortfolio,
  defaultWatchlists,
  loadPortfolios,
  loadProfile,
  loadReports,
  loadRules,
  loadScreens,
  loadWatchlists,
  savePortfolios,
  saveProfile,
  saveReports,
  saveRules,
  saveScreens,
  saveWatchlists,
  selectPortfolio,
} from './store'

afterEach(() => {
  globalThis.localStorage.clear()
  vi.unstubAllGlobals()
})

describe('research store', () => {
  it('falls back to sensible defaults', () => {
    expect(loadPortfolios()).toEqual([defaultPortfolio()])
    expect(loadWatchlists()).toEqual(defaultWatchlists())
    expect(loadReports()).toEqual([])
    expect(loadScreens()).toEqual([])
    expect(loadRules([])).toEqual([])
    expect(loadProfile()).toEqual(DEFAULT_PROFILE)
  })

  it('round-trips every collection', () => {
    const portfolio = { ...defaultPortfolio(), name: 'Growth' }
    savePortfolios([portfolio])
    expect(loadPortfolios()[0].name).toBe('Growth')

    saveWatchlists([{ id: 'w', name: 'Watch', tickers: ['ARCL'] }])
    expect(loadWatchlists()[0].tickers).toEqual(['ARCL'])

    saveReports([])
    expect(loadReports()).toEqual([])

    saveScreens([{ id: 's', name: 'Value', criteria: {}, createdAt: '2026-09-18' }])
    expect(loadScreens()[0].name).toBe('Value')

    saveRules([{ id: 'r', type: 'price', ticker: 'ARCL', threshold: 3, enabled: true }])
    expect(loadRules([])[0].ticker).toBe('ARCL')

    saveProfile({ ...DEFAULT_PROFILE, riskTolerance: 'aggressive' })
    expect(loadProfile().riskTolerance).toBe('aggressive')
  })

  it('ignores corrupt collections', () => {
    globalThis.localStorage.setItem(RESEARCH_KEYS.watchlists, '{"not":"an array"}')
    expect(loadWatchlists()).toEqual(defaultWatchlists())
  })

  it('selects a portfolio by id and falls back when the id is unknown', () => {
    const portfolios = [defaultPortfolio(), { ...defaultPortfolio(), id: 'second' }]
    expect(selectPortfolio(portfolios, 'second').id).toBe('second')
    expect(selectPortfolio(portfolios, 'missing')).toBe(portfolios[0])
  })
})
