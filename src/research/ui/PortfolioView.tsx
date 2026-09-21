import { useMemo, useState } from 'react'
import {
  buildHoldings,
  concentration,
  correlationMatrix,
  exposureBy,
  riskHeatMap,
  riskMetrics,
  runStressTests,
} from '../risk'
import {
  ASSET_CLASS_LABELS,
  BENCHMARKS,
  allocateContribution,
  benchmarkStatistics,
  compareToCurrent,
  portfolioStatistics,
  rebalancingRules,
  targetAllocation,
  taxConsiderations,
} from '../builder'
import { dividendPortfolio } from '../dividends'
import { exposureMap } from '../macro'
import { formatCurrency, formatNumber, formatPercent, NOT_AVAILABLE } from '../format'
import { getCompany } from '../universe'
import { DataTable, Disclaimer, MetricGrid, Panel } from './primitives'
import { assetClassFor } from './assetClass'
import type { InvestorProfile, Portfolio, Transaction } from '../types'

interface Props {
  portfolio: Portfolio
  profile: InvestorProfile
  onChangePortfolio: (portfolio: Portfolio) => void
  onChangeProfile: (profile: InvestorProfile) => void
  onOpenCompany: (ticker: string) => void
  onSaveReport: (
    module: string,
    ticker: string | null,
    assumptions: Record<string, number | string | null>,
    snapshot: Record<string, number | string | null>,
  ) => void
}

export function PortfolioView({
  portfolio,
  profile,
  onChangePortfolio,
  onChangeProfile,
  onOpenCompany,
  onSaveReport,
}: Props) {
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState(0)
  const [includeAlternatives, setIncludeAlternatives] = useState(false)
  const [status, setStatus] = useState('')

  const holdings = useMemo(
    () => buildHoldings(portfolio.positions, portfolio.cash),
    [portfolio.positions, portfolio.cash],
  )
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0)
  const metrics = riskMetrics(holdings)
  const conc = concentration(holdings)
  const matrix = correlationMatrix(portfolio.positions.map((position) => position.ticker))
  const stress = runStressTests(holdings)
  const heatMap = riskHeatMap(holdings, metrics)
  const target = targetAllocation(profile, includeAlternatives)
  const currentByClass = holdings.map((holding) => ({
    assetClass: assetClassFor(holding),
    value: holding.value,
  }))
  const comparison = compareToCurrent(target, currentByClass)
  const contribution = allocateContribution(target, comparison, profile.monthlyContribution)
  const statistics = portfolioStatistics(target)
  const benchmark = benchmarkStatistics(portfolio.benchmark)
  const income = dividendPortfolio(
    holdings
      .filter((holding) => holding.ticker !== 'CASH')
      .map((holding) => ({ ticker: holding.ticker, value: holding.value })),
  )
  const macroExposure = exposureMap(
    holdings
      .filter((holding) => holding.ticker !== 'CASH')
      .map((holding) => ({ ticker: holding.ticker, sector: holding.sector, weight: holding.weight * 100 })),
  )

  function addPosition() {
    const company = getCompany(ticker.toUpperCase())
    if (!company || quantity <= 0) {
      setStatus('Enter a known ticker and a positive quantity.')
      return
    }
    const symbol = company.security.ticker
    const price = company.prices[company.prices.length - 1].close
    const transaction: Transaction = {
      id: `txn-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      ticker: symbol,
      type: 'buy',
      quantity,
      price,
    }
    const existing = portfolio.positions.find((position) => position.ticker === symbol)
    onChangePortfolio({
      ...portfolio,
      positions: existing
        ? portfolio.positions.map((position) =>
            position.ticker === symbol
              ? { ...position, quantity: position.quantity + quantity }
              : position,
          )
        : [...portfolio.positions, { ticker: symbol, quantity }],
      transactions: [...portfolio.transactions, transaction],
    })
    setTicker('')
    setQuantity(0)
    setStatus(`${symbol} added.`)
  }

  return (
    <div className="stack">
      <Panel title={portfolio.name} subtitle="Positions, cash and benchmark">
        <MetricGrid
          items={[
            { label: 'Total value', value: formatCurrency(totalValue, 'USD', 0) },
            { label: 'Cash', value: formatCurrency(portfolio.cash, 'USD', 0) },
            { label: 'Positions', value: String(portfolio.positions.length) },
            { label: 'Transactions', value: String(portfolio.transactions.length) },
          ]}
        />
        <div className="filters__row">
          <label>
            Ticker
            <input type="text" value={ticker} onChange={(event) => setTicker(event.target.value)} />
          </label>
          <label>
            Quantity
            <input
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            />
          </label>
          <button type="button" className="btn btn--sm" onClick={addPosition}>
            Add position
          </button>
          <label>
            Cash
            <input
              type="number"
              value={portfolio.cash}
              onChange={(event) => onChangePortfolio({ ...portfolio, cash: Number(event.target.value) })}
            />
          </label>
          <label>
            Benchmark
            <select
              value={portfolio.benchmark}
              onChange={(event) => onChangePortfolio({ ...portfolio, benchmark: event.target.value })}
            >
              {BENCHMARKS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {status === '' ? null : (
          <p className="status" role="status">
            {status}
          </p>
        )}
        <DataTable
          caption="Current positions"
          columns={['Ticker', 'Quantity', 'Price', 'Value', 'Weight', 'Sector', 'Currency', '']}
          rows={holdings.map((holding) => ({
            key: holding.ticker,
            cells: [
              holding.ticker === 'CASH' ? (
                'CASH'
              ) : (
                <button key="ticker" type="button" className="link" onClick={() => onOpenCompany(holding.ticker)}>
                  {holding.ticker}
                </button>
              ),
              formatNumber(holding.quantity, 0),
              formatNumber(holding.price),
              formatNumber(holding.value, 0),
              formatPercent(holding.weight * 100),
              holding.sector,
              holding.currency,
              holding.ticker === 'CASH' ? null : (
                <button
                  key="remove"
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() =>
                    onChangePortfolio({
                      ...portfolio,
                      positions: portfolio.positions.filter((position) => position.ticker !== holding.ticker),
                    })
                  }
                >
                  Remove
                </button>
              ),
            ],
          }))}
        />
      </Panel>

      <Panel title="Risk metrics">
        <MetricGrid
          items={[
            { label: 'Annualised volatility', value: formatPercent(metrics.annualVolatility) },
            { label: 'Portfolio beta', value: formatNumber(metrics.beta, 3) },
            { label: 'Maximum drawdown', value: formatPercent(metrics.maxDrawdown) },
            { label: 'Value at risk (95%, daily)', value: formatPercent(metrics.valueAtRisk95) },
            { label: 'Expected shortfall (95%)', value: formatPercent(metrics.expectedShortfall95) },
            { label: 'Return/volatility ratio', value: formatNumber(metrics.sharpeLike, 3) },
            {
              label: 'Days to liquidate',
              value: metrics.liquidityDays === null ? NOT_AVAILABLE : formatNumber(metrics.liquidityDays),
            },
            { label: 'Rate sensitivity score', value: formatNumber(metrics.rateSensitivity) },
            { label: 'Largest position', value: formatPercent(conc.topPositionPercent) },
            { label: 'Top five positions', value: formatPercent(conc.topFivePercent) },
            { label: 'Herfindahl index', value: formatNumber(conc.herfindahl, 4) },
          ]}
        />
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            onSaveReport(
              'Portfolio risk',
              null,
              { positions: portfolio.positions.length, cash: portfolio.cash },
              {
                totalValue,
                beta: metrics.beta,
                annualVolatility: metrics.annualVolatility,
                valueAtRisk95: metrics.valueAtRisk95,
                maxDrawdown: metrics.maxDrawdown,
              },
            )
            setStatus('Risk report saved.')
          }}
        >
          Save risk report
        </button>
      </Panel>

      {(['sector', 'country', 'currency'] as const).map((key) => (
        <Panel key={key} title={`${key} exposure`}>
          <DataTable
            caption={`Exposure by ${key}`}
            columns={[key, 'Value', 'Share']}
            rows={exposureBy(holdings, key).map((slice) => ({
              key: slice.label,
              cells: [slice.label, formatNumber(slice.value, 0), formatPercent(slice.percent)],
            }))}
          />
        </Panel>
      ))}

      <Panel title="Correlation matrix">
        <DataTable
          caption="Pairwise correlation of holdings"
          columns={['', ...matrix.tickers]}
          rows={matrix.matrix.map((row, index) => ({
            key: matrix.tickers[index],
            cells: [matrix.tickers[index], ...row.map((value) => formatNumber(value, 2))],
          }))}
        />
      </Panel>

      <Panel title="Stress scenarios">
        <DataTable
          caption="Stress test results"
          columns={['Scenario', 'Portfolio impact', 'Value impact', 'Most affected', 'Description']}
          rows={stress.map((scenario) => ({
            key: scenario.id,
            cells: [
              scenario.label,
              formatPercent(scenario.portfolioImpactPercent),
              formatNumber(scenario.portfolioImpactValue, 0),
              scenario.worstHoldings.map((entry) => `${entry.ticker} ${entry.impactPercent}%`).join(', '),
              scenario.description,
            ],
          }))}
        />
        <Disclaimer>
          Stress estimates apply historical sensitivities to a hypothetical shock. They illustrate exposure; they are
          not guaranteed outcomes.
        </Disclaimer>
      </Panel>

      <Panel title="Risk heat map">
        <DataTable
          caption="Risk heat map"
          columns={['Risk', 'Exposure', 'Severity', 'Contributors', 'Potential mitigation']}
          rows={heatMap.map((row) => ({
            key: row.risk,
            cells: [
              row.risk,
              row.exposure,
              <span key="severity" className={`pill is-${row.severity}`}>
                {row.severity}
              </span>,
              row.contributors.join(', '),
              row.mitigation,
            ],
          }))}
        />
      </Panel>

      <Panel title="Investor profile">
        <div className="filters">
          <label>
            Investment amount
            <input
              type="number"
              value={profile.investmentAmount}
              onChange={(event) =>
                onChangeProfile({ ...profile, investmentAmount: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Horizon (years)
            <input
              type="number"
              value={profile.horizonYears}
              onChange={(event) => onChangeProfile({ ...profile, horizonYears: Number(event.target.value) })}
            />
          </label>
          <label>
            Risk tolerance
            <select
              value={profile.riskTolerance}
              onChange={(event) =>
                onChangeProfile({
                  ...profile,
                  riskTolerance: event.target.value as InvestorProfile['riskTolerance'],
                })
              }
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="growth">Growth</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>
          <label>
            Income requirement (%)
            <input
              type="number"
              value={profile.incomeNeedPercent}
              onChange={(event) =>
                onChangeProfile({ ...profile, incomeNeedPercent: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Liquidity reserve (%)
            <input
              type="number"
              value={profile.liquidityReservePercent}
              onChange={(event) =>
                onChangeProfile({ ...profile, liquidityReservePercent: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Account type
            <select
              value={profile.accountType}
              onChange={(event) =>
                onChangeProfile({
                  ...profile,
                  accountType: event.target.value as InvestorProfile['accountType'],
                })
              }
            >
              <option value="taxable">Taxable</option>
              <option value="tax-deferred">Tax deferred</option>
              <option value="tax-free">Tax free</option>
            </select>
          </label>
          <label>
            Monthly contribution
            <input
              type="number"
              value={profile.monthlyContribution}
              onChange={(event) =>
                onChangeProfile({ ...profile, monthlyContribution: Number(event.target.value) })
              }
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeAlternatives}
              onChange={(event) => setIncludeAlternatives(event.target.checked)}
            />
            Include alternatives
          </label>
        </div>
      </Panel>

      <Panel title="Target allocation" subtitle="Core and satellite sleeves with example ETFs">
        <DataTable
          caption="Target allocation"
          columns={['Asset class', 'Target', 'Role', 'Example ETF']}
          rows={target.map((slice) => ({
            key: slice.assetClass,
            cells: [
              ASSET_CLASS_LABELS[slice.assetClass],
              formatPercent(slice.targetPercent),
              slice.role,
              slice.exampleEtf,
            ],
          }))}
        />
        <MetricGrid
          items={[
            { label: 'Expected return', value: formatPercent(statistics.expectedReturn) },
            { label: 'Expected volatility', value: formatPercent(statistics.volatility) },
            { label: 'Income yield', value: formatPercent(statistics.incomeYield) },
            {
              label: 'Benchmark expected return',
              value: benchmark === null ? NOT_AVAILABLE : formatPercent(benchmark.expectedReturn),
            },
            {
              label: 'Benchmark volatility',
              value: benchmark === null ? NOT_AVAILABLE : formatPercent(benchmark.volatility),
            },
          ]}
        />
      </Panel>

      <Panel title="Current versus target">
        <DataTable
          caption="Rebalancing plan"
          columns={['Asset class', 'Target', 'Current', 'Drift', 'Trade', 'Action']}
          rows={comparison.map((row) => ({
            key: row.assetClass,
            cells: [
              ASSET_CLASS_LABELS[row.assetClass],
              formatPercent(row.targetPercent),
              formatPercent(row.currentPercent),
              formatPercent(row.driftPercent),
              formatNumber(row.tradeValue, 0),
              row.action,
            ],
          }))}
        />
        <DataTable
          caption="Contribution allocation"
          columns={['Asset class', 'Amount']}
          rows={contribution.map((entry) => ({
            key: entry.assetClass,
            cells: [ASSET_CLASS_LABELS[entry.assetClass], formatNumber(entry.amount, 0)],
          }))}
        />
        <h4>Rebalancing rules</h4>
        <ul className="dashboard__list">
          {rebalancingRules(profile).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <h4>Tax context</h4>
        <ul className="dashboard__list">
          {taxConsiderations(profile).map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <Disclaimer>
          Tax notes are general context about account types, not personalised tax advice.
        </Disclaimer>
      </Panel>

      <Panel title="Dividend income">
        <MetricGrid
          items={[
            { label: 'Weighted yield', value: formatPercent(income.weightedYieldPercent) },
            { label: 'Estimated annual income', value: formatNumber(income.annualIncome, 0) },
            { label: 'Estimated quarterly income', value: formatNumber(income.quarterlyIncome, 0) },
            { label: 'Estimated monthly income', value: formatNumber(income.monthlyIncome, 0) },
          ]}
        />
        <DataTable
          caption="Income by sector"
          columns={['Sector', 'Income', 'Share']}
          rows={income.bySector.map((entry) => ({
            key: entry.label,
            cells: [entry.label, formatNumber(entry.income, 0), formatPercent(entry.percent)],
          }))}
        />
        {income.unavailable.length > 0 ? (
          <p className="empty">
            No dividend data for: {income.unavailable.join(', ')}. These holdings are excluded rather than assumed to
            yield zero.
          </p>
        ) : null}
      </Panel>

      <Panel title="Macro exposure">
        <DataTable
          caption="Macro factor exposure"
          columns={['Factor', 'Sensitivity', 'Affected holdings', 'Mechanism']}
          rows={macroExposure.map((row) => ({
            key: row.factor,
            cells: [
              row.label,
              formatNumber(row.sensitivity, 2),
              row.holdings.map((holding) => holding.ticker).join(', '),
              row.mechanism,
            ],
          }))}
        />
      </Panel>

      <Panel title="Transactions">
        <DataTable
          caption="Transaction history"
          columns={['Date', 'Ticker', 'Type', 'Quantity', 'Price']}
          rows={portfolio.transactions.map((transaction) => ({
            key: transaction.id,
            cells: [
              transaction.date,
              transaction.ticker,
              transaction.type,
              formatNumber(transaction.quantity, 0),
              formatNumber(transaction.price),
            ],
          }))}
        />
      </Panel>
    </div>
  )
}
