import { describe, expect, it } from 'vitest'
import { INTERPRETATION_DISCLAIMER, buildGrounding, interpret, median } from './orchestrator'

describe('research orchestration', () => {
  it('computes peer medians for odd, even and empty samples', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('grounds the interpretation in calculated data', () => {
    const bundle = buildGrounding('ARCL', { wacc: 0.09 })!
    expect(bundle.security.ticker).toBe('ARCL')
    expect(bundle.marketData.price).toBeGreaterThan(0)
    expect(bundle.calculatedMetrics.forwardPe).not.toBeNull()
    expect(bundle.peerMedians.forwardPe).not.toBeNull()
    expect(bundle.macro['policy-rate']).toBeGreaterThan(0)
    expect(bundle.assumptions.wacc).toBe(0.09)
    expect(bundle.sources).toHaveLength(2)
    expect(buildGrounding('NOPE')).toBeNull()
  })

  it('names missing inputs instead of filling them in', () => {
    const bundle = buildGrounding('AQFL')!
    expect(bundle.missing).toContain('Options chain (market-implied earnings move)')
    expect(bundle.missing).toContain('Market-share history')
    expect(bundle.missing).toContain('Sourced qualitative commentary')
    const nonPayer = buildGrounding('NBLA')!
    expect(nonPayer.missing).toContain('Dividend history')
    expect(nonPayer.calculatedMetrics.dividendYield).toBeNull()
    expect(buildGrounding('ARCL')!.missing).toEqual([])
  })

  it('writes sections that only reference grounded values', () => {
    const interpretation = interpret(buildGrounding('ARCL')!)
    expect(interpretation.headline).toContain('Arclight Semiconductor')
    expect(interpretation.sections).toHaveLength(6)
    expect(interpretation.sections[0].body).toContain('forward earnings')
    expect(interpretation.sections[3].body).toContain('%')
    expect(interpretation.disclaimer).toBe(INTERPRETATION_DISCLAIMER)
  })

  it('states when a comparison or a dividend is unavailable', () => {
    const bundle = buildGrounding('NBLA')!
    const interpretation = interpret(bundle)
    expect(interpretation.sections[3].body).toContain('no dividend record')
    expect(interpretation.missing).toContain('Dividend history')
    const withoutPeers = interpret({ ...bundle, peerMedians: { forwardPe: null } })
    expect(withoutPeers.sections[0].body).toContain('Not available')
  })

  it('describes a cheaper multiple when the company trades below its peers', () => {
    const bundle = buildGrounding('ARCL')!
    const cheap = interpret({ ...bundle, peerMedians: { ...bundle.peerMedians, forwardPe: 999 } })
    expect(cheap.sections[0].body).toContain('a discount to the peer set')
    const rich = interpret({ ...bundle, peerMedians: { ...bundle.peerMedians, forwardPe: 1 } })
    expect(rich.sections[0].body).toContain('a premium to the peer set')
  })
})
