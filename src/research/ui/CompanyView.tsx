import { useState } from 'react'
import { getCompany } from '../universe'
import { formatCompact, formatNumber, formatPercent, NOT_AVAILABLE } from '../format'
import { DataTable, MetricGrid, Panel, ProvenanceNote, Tabs } from './primitives'
import { CompanyOverview } from './CompanyOverview'
import { CompanyValuation } from './CompanyValuation'
import { CompanyEarnings } from './CompanyEarnings'
import { CompanyTechnicals } from './CompanyTechnicals'
import { CompanyQuant } from './CompanyQuant'
import { CompanyCompetition } from './CompanyCompetition'
import { CompanyDividends } from './CompanyDividends'
import type { CompanyRecord, ResearchWatchlist } from '../types'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'financials', label: 'Financials' },
  { id: 'valuation', label: 'Valuation' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'technicals', label: 'Technicals' },
  { id: 'quant', label: 'Quant' },
  { id: 'competition', label: 'Competition' },
  { id: 'dividends', label: 'Dividends' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'news', label: 'News' },
]

function Financials({ company }: { company: CompanyRecord }) {
  const f = company.fundamentals
  const currency = company.security.currency
  return (
    <Panel title="Financial summary" subtitle="Structured statement data from the connected provider">
      <DataTable
        caption="Income statement and cash flow summary"
        columns={['Line item', 'Value']}
        rows={[
          ['Revenue', formatCompact(f.revenue, currency)],
          ['Gross margin', formatPercent(f.grossMargin * 100)],
          ['Operating margin', formatPercent(f.operatingMargin * 100)],
          ['Net margin', formatPercent(f.netMargin * 100)],
          ['Diluted EPS', formatNumber(f.eps)],
          ['Depreciation & amortisation', formatCompact(f.depreciation, currency)],
          ['Capital expenditure', formatCompact(f.capex, currency)],
          ['Change in working capital', formatCompact(f.workingCapitalChange, currency)],
          ['Free cash flow', formatCompact(f.freeCashFlow, currency)],
          ['Research & development', formatCompact(f.researchAndDevelopment, currency)],
          ['Net debt', formatCompact(f.netDebt, currency)],
          ['Debt / equity', formatNumber(f.debtToEquity)],
          ['Effective tax rate', formatPercent(f.taxRate * 100)],
          ['Diluted shares', formatNumber(f.dilutedShares, 0)],
        ].map(([label, value]) => ({ key: label, cells: [label, value] }))}
      />
    </Panel>
  )
}

function Ownership({ company }: { company: CompanyRecord }) {
  return (
    <div className="stack">
      <Panel title="Ownership">
        <MetricGrid
          items={[
            { label: 'Institutional ownership', value: formatPercent(company.ownership.institutionalPercent) },
            { label: 'Insider ownership', value: formatPercent(company.ownership.insiderPercent) },
            { label: 'Short interest', value: formatPercent(company.ownership.shortInterestPercent) },
          ]}
        />
      </Panel>
      <Panel title="Insider transactions">
        {company.insiders.length === 0 ? (
          <p className="empty">{NOT_AVAILABLE}</p>
        ) : (
          <DataTable
            caption="Recent insider transactions"
            columns={['Date', 'Person', 'Type', 'Shares', 'Value']}
            rows={company.insiders.map((transaction) => ({
              key: `${transaction.date}-${transaction.person}-${transaction.type}`,
              cells: [
                transaction.date,
                transaction.person,
                transaction.type,
                formatNumber(transaction.shares, 0),
                formatNumber(transaction.value, 0),
              ],
            }))}
          />
        )}
      </Panel>
      <Panel title="Options snapshot">
        {company.options === null ? (
          <p className="empty">No options data is connected for this security.</p>
        ) : (
          <MetricGrid
            items={[
              { label: 'Expiry', value: company.options.expiry },
              { label: 'Underlying price', value: formatNumber(company.options.underlyingPrice) },
              { label: 'ATM call', value: formatNumber(company.options.atmCall) },
              { label: 'ATM put', value: formatNumber(company.options.atmPut) },
            ]}
          />
        )}
      </Panel>
    </div>
  )
}

interface Props {
  ticker: string | null
  watchlists: ResearchWatchlist[]
  onAddToWatchlist: (watchlistId: string, ticker: string) => void
  onSaveReport: (
    module: string,
    ticker: string,
    assumptions: Record<string, number | string | null>,
    snapshot: Record<string, number | string | null>,
  ) => void
}

export function CompanyView({ ticker, watchlists, onAddToWatchlist, onSaveReport }: Props) {
  const [tab, setTab] = useState('overview')
  const company = ticker === null ? undefined : getCompany(ticker)

  if (!company) {
    return (
      <Panel title="Company research">
        <p className="empty">Search for a company above to open its research workspace.</p>
      </Panel>
    )
  }

  const prices = company.prices
  const lastClose = prices[prices.length - 1].close
  const previousClose = prices[prices.length - 2].close
  const changePercent = ((lastClose - previousClose) / previousClose) * 100

  return (
    <div className="stack">
      <Panel
        title={`${company.security.ticker} · ${company.security.name}`}
        subtitle={`${company.security.exchange} · ${company.security.sector} · ${company.security.industry} · ${company.security.country}`}
        actions={
          watchlists.length === 0 ? null : (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onAddToWatchlist(watchlists[0].id, company.security.ticker)}
            >
              Add to {watchlists[0].name}
            </button>
          )
        }
      >
        <MetricGrid
          items={[
            { label: 'Last price', value: `${formatNumber(lastClose)} ${company.security.currency}` },
            { label: 'Session change', value: formatPercent(changePercent) },
            { label: 'Market cap', value: formatCompact(company.fundamentals.marketCap, company.security.currency) },
            { label: 'Next earnings', value: company.nextEarningsDate },
          ]}
        />
        <ProvenanceNote sources={[company.provenance]} />
      </Panel>

      <Tabs tabs={TABS} active={tab} onSelect={setTab} label="Company research sections" />

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' ? <CompanyOverview company={company} /> : null}
        {tab === 'financials' ? <Financials company={company} /> : null}
        {tab === 'valuation' ? (
          <CompanyValuation
            company={company}
            onSaveReport={(assumptions, snapshot) =>
              onSaveReport('DCF valuation', company.security.ticker, assumptions, snapshot)
            }
          />
        ) : null}
        {tab === 'earnings' ? <CompanyEarnings company={company} /> : null}
        {tab === 'technicals' ? <CompanyTechnicals company={company} /> : null}
        {tab === 'quant' ? <CompanyQuant company={company} /> : null}
        {tab === 'competition' ? <CompanyCompetition company={company} /> : null}
        {tab === 'dividends' ? <CompanyDividends company={company} /> : null}
        {tab === 'ownership' ? <Ownership company={company} /> : null}
        {tab === 'news' ? (
          <Panel title="News">
            <p className="empty">
              No news provider is connected. Rather than generate headlines, this tab stays empty until a sourced news
              feed is configured.
            </p>
          </Panel>
        ) : null}
      </div>
    </div>
  )
}
