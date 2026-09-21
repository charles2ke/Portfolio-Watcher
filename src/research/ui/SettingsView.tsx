import { ALERT_TYPE_LABELS, type AlertRule } from '../researchAlerts'
import { AS_OF, DATA_PROVIDER, DATA_SOURCE, RETRIEVED_AT, UNIVERSE } from '../universe'
import { MACRO_SERIES } from '../macro'
import { CALCULATION_VERSION, MODEL_VERSION } from '../reports'
import { INTERPRETATION_DISCLAIMER } from '../orchestrator'
import { DataTable, Disclaimer, MetricGrid, Panel } from './primitives'
import type { ResearchAlert } from '../types'

interface Props {
  rules: AlertRule[]
  alerts: ResearchAlert[]
  onChangeRules: (rules: AlertRule[]) => void
}

export function SettingsView({ rules, alerts, onChangeRules }: Props) {
  return (
    <div className="stack">
      <Panel title="Alert rules" subtitle="Price, earnings, valuation, dividend, technical, concentration and macro">
        <DataTable
          caption="Alert rules"
          columns={['Type', 'Subject', 'Threshold', 'Enabled']}
          rows={rules.map((rule) => ({
            key: rule.id,
            cells: [
              ALERT_TYPE_LABELS[rule.type],
              rule.ticker ?? (rule.type === 'macro' ? 'Macro' : 'Portfolio'),
              <input
                key="threshold"
                type="number"
                value={rule.threshold}
                aria-label={`${rule.id} threshold`}
                onChange={(event) =>
                  onChangeRules(
                    rules.map((entry) =>
                      entry.id === rule.id ? { ...entry, threshold: Number(event.target.value) } : entry,
                    ),
                  )
                }
              />,
              <label key="enabled" className="checkbox">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  aria-label={`${rule.id} enabled`}
                  onChange={(event) =>
                    onChangeRules(
                      rules.map((entry) =>
                        entry.id === rule.id ? { ...entry, enabled: event.target.checked } : entry,
                      ),
                    )
                  }
                />
                <span className="sr-only">enabled</span>
              </label>,
            ],
          }))}
        />
      </Panel>

      <Panel title="Triggered alerts">
        {alerts.length === 0 ? (
          <p className="empty">No rule is currently triggered.</p>
        ) : (
          <DataTable
            caption="Triggered alerts"
            columns={['Type', 'Subject', 'Message', 'Severity']}
            rows={alerts.map((alert) => ({
              key: alert.id,
              cells: [ALERT_TYPE_LABELS[alert.type], alert.subject, alert.message, alert.severity],
            }))}
          />
        )}
      </Panel>

      <Panel title="Data sources and provenance">
        <MetricGrid
          items={[
            { label: 'Market data provider', value: DATA_PROVIDER },
            { label: 'Source', value: DATA_SOURCE },
            { label: 'As of', value: AS_OF },
            { label: 'Retrieved at', value: RETRIEVED_AT },
            { label: 'Securities covered', value: String(UNIVERSE.length) },
            { label: 'Macro series', value: String(MACRO_SERIES.length) },
            { label: 'Interpretation model version', value: MODEL_VERSION },
            { label: 'Calculation version', value: CALCULATION_VERSION },
          ]}
        />
        <Disclaimer>
          This build ships with a bundled, explicitly synthetic dataset so that every calculation is reproducible. It
          contains no real company financials. Connect a licensed market-data provider behind the same provider
          interface to research real securities.
        </Disclaimer>
        <Disclaimer>{INTERPRETATION_DISCLAIMER}</Disclaimer>
      </Panel>
    </div>
  )
}
