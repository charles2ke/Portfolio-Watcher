import { describe, expect, it } from 'vitest'
import { CALCULATION_VERSION, MODEL_VERSION, createReport, reportToCsv, reportToHtml } from './reports'
import type { Provenance } from './types'

const provenance: Provenance = {
  provider: 'Sample provider',
  source: 'bundled-sample-v1',
  asOf: '2026-09-18',
  retrievedAt: '2026-09-18T21:05:00.000Z',
  currency: 'USD',
}

const report = createReport({
  id: 'r1',
  title: 'ARCL discounted cash flow',
  module: 'DCF',
  ticker: 'ARCL',
  createdAt: '2026-09-18T12:00:00.000Z',
  assumptions: { wacc: 0.089, terminalGrowth: 0.025, note: 'base case', exitMultiple: null },
  snapshot: { valuePerShare: 196.4, upsidePercent: null },
  sources: [provenance],
})

describe('research reports', () => {
  it('freezes assumptions, results and sources at generation time', () => {
    const assumptions = { wacc: 0.09 }
    const created = createReport({ ...report, assumptions, sources: [provenance] })
    assumptions.wacc = 0.2
    expect(created.assumptions.wacc).toBe(0.09)
    expect(created.modelVersion).toBe(MODEL_VERSION)
    expect(created.calculationVersion).toBe(CALCULATION_VERSION)
    expect(created.sources[0]).not.toBe(provenance)
  })

  it('exports CSV with assumptions, results and sources', () => {
    const csv = reportToCsv(report)
    expect(csv).toContain('Assumption,wacc,0.089')
    expect(csv).toContain('Assumption,exitMultiple,n/a')
    expect(csv).toContain('Result,upsidePercent,n/a')
    expect(csv).toContain('Source,Sample provider')
    const portfolioReport = createReport({ ...report, ticker: null })
    expect(reportToCsv(portfolioReport)).toContain('Report,Ticker,n/a')
    const quoted = createReport({ ...report, snapshot: { note: 'a, "b"' } })
    expect(reportToCsv(quoted)).toContain('"a, ""b"""')
  })

  it('renders print-ready HTML that escapes user content', () => {
    const html = reportToHtml(
      createReport({ ...report, title: '<script>alert("x")</script> & co' }),
    )
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co')
    expect(html).toContain('Not available')
    expect(html).toContain('frozen snapshot')
    expect(reportToHtml(createReport({ ...report, ticker: null }))).toContain('portfolio')
  })
})
