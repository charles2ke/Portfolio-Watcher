import { describe, expect, it } from 'vitest'
import {
  METRICS,
  compareRows,
  createSavedScreen,
  screen,
  sortRows,
  toCsv,
  toRow,
  toXlsxXml,
} from './screener'
import { UNIVERSE, getCompany } from './universe'

describe('stock screener', () => {
  it('projects a company into a screener row using stored fundamentals', () => {
    const company = getCompany('ARCL')!
    const row = toRow(company)
    expect(row.ticker).toBe('ARCL')
    expect(row.metrics.peRatio).toBe(company.fundamentals.peRatio)
    expect(row.price).toBe(company.prices[company.prices.length - 1].close)
    expect(Object.keys(row.metrics)).toHaveLength(METRICS.length)
  })

  it('filters by facets and metric ranges', () => {
    expect(screen({})).toHaveLength(UNIVERSE.length)
    const tech = screen({ sectors: ['Information Technology'] })
    expect(tech.map((row) => row.ticker).sort()).toEqual(['ARCL', 'NBLA'])
    expect(screen({ industries: ['Semiconductors'] }).map((row) => row.ticker)).toEqual(['ARCL'])
    expect(screen({ countries: ['Japan'] }).map((row) => row.ticker)).toEqual(['KNSU'])
    expect(screen({ ranges: { dividendYield: { min: 99 } } })).toEqual([])
    expect(screen({ ranges: { dividendYield: { max: 0 } } }).map((row) => row.ticker)).toEqual([
      'NBLA',
    ])
    expect(screen({ ranges: { roic: {} } })).toHaveLength(UNIVERSE.length)
    expect(screen({ sectors: [] })).toHaveLength(UNIVERSE.length)
  })

  it('sorts ascending and descending', () => {
    const rows = screen({})
    const byYield = sortRows(rows, 'dividendYield', 'desc')
    expect(byYield[0].metrics.dividendYield).toBeGreaterThanOrEqual(
      byYield[byYield.length - 1].metrics.dividendYield,
    )
    expect(sortRows(rows, 'ticker', 'asc')[0].ticker).toBe('AQFL')
    expect(sortRows(rows, 'ticker', 'desc')[0].ticker).toBe('ZPHR')
  })

  it('saves screens with a defensive copy of the criteria', () => {
    const criteria = { sectors: ['Energy'] }
    const saved = createSavedScreen('s1', 'Energy value', criteria, '2026-09-18T10:00:00.000Z')
    criteria.sectors.push('Utilities')
    expect(saved.criteria.sectors).toEqual(['Energy'])
    expect(saved.name).toBe('Energy value')
  })

  it('compares selected tickers and marks unknown ones as unavailable', () => {
    const rows = screen({})
    const comparison = compareRows(rows, ['ARCL', 'ZZZZ'])
    expect(comparison[0].values[0].value).not.toBeNull()
    expect(comparison[0].values[1].value).toBeNull()
  })

  it('exports CSV and spreadsheet XML', () => {
    const rows = screen({ sectors: ['Materials'] })
    const csv = toCsv(rows)
    expect(csv.split('\n')).toHaveLength(2)
    expect(csv).toContain('SLVM')
    const quoted = toCsv([{ ...rows[0], name: 'Silvermoor, "Ltd"' }])
    expect(quoted).toContain('"Silvermoor, ""Ltd"""')
    const xml = toXlsxXml(rows)
    expect(xml).toContain('<Worksheet ss:Name="Screen">')
    expect(xml).toContain('ss:Type="Number"')
    expect(toXlsxXml([{ ...rows[0], name: 'A & B <Co>' }])).toContain('A &amp; B &lt;Co>')
  })
})
