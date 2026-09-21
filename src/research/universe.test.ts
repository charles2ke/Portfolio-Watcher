import { describe, expect, it } from 'vitest'
import {
  COUNTRIES,
  MARKET_INDEX,
  SECTORS,
  UNIVERSE,
  dailyReturns,
  getCompany,
  rank,
  searchSecurities,
  standardDeviation,
  tradingDates,
} from './universe'
import { createRandom, hashString, normalFrom } from './random'

describe('random helpers', () => {
  it('hashes deterministically', () => {
    expect(hashString('ARCL')).toBe(hashString('ARCL'))
    expect(hashString('ARCL')).not.toBe(hashString('NBLA'))
  })

  it('produces a reproducible stream in [0, 1)', () => {
    const first = createRandom(42)
    const second = createRandom(42)
    const values = [first(), first(), first()]
    expect(values).toEqual([second(), second(), second()])
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('draws finite normal variates, including when the uniform draw is zero', () => {
    expect(Number.isFinite(normalFrom(createRandom(7)))).toBe(true)
    let call = 0
    const random = () => (call++ === 0 ? 0 : 0.5)
    expect(Number.isFinite(normalFrom(random))).toBe(true)
  })
})

describe('sample universe', () => {
  it('only contains business days, oldest first', () => {
    const dates = tradingDates(5, '2026-09-18')
    expect(dates).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'])
  })

  it('builds a complete company record', () => {
    const company = getCompany(' arcl ')
    expect(company).toBeDefined()
    expect(company?.security.name).toBe('Arclight Semiconductor')
    expect(company?.prices).toHaveLength(504)
    expect(company?.earnings).toHaveLength(4)
    expect(company?.moat).toHaveLength(9)
    expect(company?.dividend?.cagr10y).toBeNull()
    expect(company?.provenance.source).toBe('bundled-sample-v1')
    expect(company?.fundamentals.marketCap).toBeGreaterThan(0)
    expect(company?.options).not.toBeNull()
  })

  it('represents missing data instead of inventing it', () => {
    const company = getCompany('MDCR')
    expect(company?.marketShare).toBeNull()
    const nonPayer = getCompany('NBLA')
    expect(nonPayer?.dividend).toBeNull()
    expect(getCompany('NOPE')).toBeUndefined()
    const withoutOptions = getCompany('AQFL')
    expect(withoutOptions?.options).toBeNull()
    expect(withoutOptions?.dividend?.cagr10y).not.toBeNull()
  })

  it('keeps every record internally consistent', () => {
    for (const company of UNIVERSE) {
      const last = company.prices[company.prices.length - 1]
      expect(last.high).toBeGreaterThanOrEqual(last.close)
      expect(last.low).toBeLessThanOrEqual(last.close)
      expect(company.fundamentals.peRatio).toBeCloseTo(last.close / company.fundamentals.eps, 1)
      expect(company.provenance.currency).toBe(company.security.currency)
      expect(company.insiders).toHaveLength(2)
      expect(company.kpis.length).toBeGreaterThan(0)
    }
    expect(MARKET_INDEX).toHaveLength(504)
  })

  it('searches by ticker, name and exchange with ranked results', () => {
    expect(searchSecurities('arcl')[0].ticker).toBe('ARCL')
    expect(searchSecurities('nebula')[0].ticker).toBe('NBLA')
    expect(searchSecurities('SIX').map((security) => security.ticker)).toContain('HLVT')
    expect(searchSecurities('   ')).toEqual([])
    expect(searchSecurities('a', 3)).toHaveLength(3)
    expect(searchSecurities('AR')[0].ticker).toBe('ARCL')
  })

  it('ranks exact tickers ahead of prefix and name matches', () => {
    const arcl = getCompany('ARCL')!.security
    expect(rank(arcl, 'arcl')).toBe(0)
    expect(rank(arcl, 'arc')).toBe(1)
    expect(rank(arcl, 'arclight')).toBe(2)
    expect(rank(arcl, 'semiconductor')).toBe(3)
  })

  it('exposes sector and country facets', () => {
    expect(SECTORS).toContain('Information Technology')
    expect(COUNTRIES).toContain('Japan')
  })

  it('computes returns and dispersion', () => {
    expect(dailyReturns([100, 110, 99])).toEqual([0.1, -0.1])
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3)
    expect(standardDeviation([1])).toBe(0)
  })
})
