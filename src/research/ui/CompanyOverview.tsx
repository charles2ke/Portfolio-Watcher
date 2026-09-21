import { Disclaimer, MetricGrid, Panel } from './primitives'
import { formatCompact, formatNumber, formatPercent } from '../format'
import { buildGrounding, interpret } from '../orchestrator'
import type { CompanyRecord } from '../types'

export function CompanyOverview({ company }: { company: CompanyRecord }) {
  const grounding = buildGrounding(company.security.ticker)
  if (!grounding) return null
  const interpretation = interpret(grounding)
  const f = company.fundamentals

  return (
    <div className="stack">
      <Panel title="Key figures" subtitle={`${company.security.industry} · ${company.security.country}`}>
        <MetricGrid
          items={[
            { label: 'Market cap', value: formatCompact(f.marketCap, company.security.currency) },
            { label: 'Revenue (TTM)', value: formatCompact(f.revenue, company.security.currency) },
            { label: 'Revenue growth', value: formatPercent(f.revenueGrowth * 100) },
            { label: 'Operating margin', value: formatPercent(f.operatingMargin * 100) },
            { label: 'ROIC', value: formatPercent(f.roic * 100) },
            { label: 'Forward P/E', value: formatNumber(f.forwardPe) },
            { label: 'EV/EBITDA', value: formatNumber(f.evToEbitda) },
            { label: 'Free cash flow', value: formatCompact(f.freeCashFlow, company.security.currency) },
            { label: '12M momentum', value: formatPercent(f.momentum12m) },
          ]}
        />
      </Panel>

      <Panel title={interpretation.headline} subtitle="Rule-based interpretation of the calculated results">
        {interpretation.sections.map((section) => (
          <div key={section.title} className="interpretation">
            <h4>{section.title}</h4>
            <p>{section.body}</p>
            <p className="interpretation__basis">Derived from: {section.basis.join(', ')}</p>
          </div>
        ))}
        {interpretation.missing.length > 0 ? (
          <div className="missing" role="note">
            <p className="missing__title">Not available from the connected data sources</p>
            <ul>
              {interpretation.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <Disclaimer>{interpretation.disclaimer}</Disclaimer>
      </Panel>
    </div>
  )
}
