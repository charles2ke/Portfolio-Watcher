import { describe, expect, it } from 'vitest'
import {
  comparisonTable,
  competitiveLandscape,
  industryPeers,
  marketShareTrends,
  moatComparison,
  peerSet,
  qualitativeSections,
} from './competition'
import { getCompany } from './universe'
import type { CompanyRecord } from './types'

describe('competitive landscape', () => {
  it('resolves the declared peer set', () => {
    expect(peerSet('ARCL').map((peer) => peer.security.ticker)).toEqual(['KNSU', 'NBLA', 'CNVX'])
    expect(peerSet('NOPE')).toEqual([])
  })

  it('tops up a short peer list with same-sector companies', () => {
    const nebula = getCompany('NBLA')!
    const extra: CompanyRecord = {
      ...nebula,
      security: { ...nebula.security, ticker: 'TSTX' },
    }
    const universe = [nebula, extra]
    expect(peerSet('ARCL', 3, universe).map((peer) => peer.security.ticker)).toEqual([
      'KNSU',
      'NBLA',
      'CNVX',
    ])
    expect(peerSet('ARCL', 4, universe).map((peer) => peer.security.ticker)).toEqual([
      'KNSU',
      'NBLA',
      'CNVX',
      'TSTX',
    ])
    expect(peerSet('ARCL', 1).map((peer) => peer.security.ticker)).toEqual(['KNSU'])
  })

  it('lists peers in an industry', () => {
    expect(industryPeers('Semiconductors').map((peer) => peer.security.ticker)).toEqual(['ARCL'])
  })

  it('builds the comparison, moat and market-share views', () => {
    const company = getCompany('ARCL')!
    const group = [company, ...peerSet('ARCL')]
    const table = comparisonTable(group)
    expect(table[0].metric).toBe('Market cap')
    expect(table[0].values).toHaveLength(4)
    expect(moatComparison(group)[0].dimension).toBe('Brand')
    expect(moatComparison([])).toEqual([])
    const missingDimension = moatComparison([company, { ...company, moat: [] }])
    expect(missingDimension[0].values[1].score).toBeNull()
    const shares = marketShareTrends(group)
    expect(shares[0].points).not.toBeNull()
    expect(marketShareTrends([getCompany('MDCR')!])[0].points).toBeNull()
  })

  it('flags qualitative sections without sourced commentary', () => {
    expect(qualitativeSections(getCompany('ARCL')!).every((section) => section.available)).toBe(true)
    expect(qualitativeSections(getCompany('NBLA')!).every((section) => section.available)).toBe(false)
  })

  it('assembles the full landscape', () => {
    const landscape = competitiveLandscape('CNVX')!
    expect(landscape.company.security.ticker).toBe('CNVX')
    expect(landscape.peers).toHaveLength(3)
    expect(landscape.table).toHaveLength(10)
    expect(landscape.qualitative).toHaveLength(5)
    expect(competitiveLandscape('NOPE')).toBeNull()
  })
})
