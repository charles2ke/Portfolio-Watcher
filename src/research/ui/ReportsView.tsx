import { useState } from 'react'
import { reportToCsv, reportToHtml } from '../reports'
import { downloadCsv, printHtml } from '../download'
import { describeProvenance } from '../format'
import { DataTable, Disclaimer, Panel } from './primitives'
import type { ResearchReport } from '../types'

interface Props {
  reports: ResearchReport[]
  onDelete: (id: string) => void
}

export function ReportsView({ reports, onDelete }: Props) {
  const [status, setStatus] = useState('')

  if (reports.length === 0) {
    return (
      <Panel title="Research reports">
        <p className="empty">
          Save a DCF, risk or screening analysis to store it here with a frozen snapshot of its inputs and results.
        </p>
      </Panel>
    )
  }

  return (
    <div className="stack">
      {status === '' ? null : (
        <p className="status" role="status">
          {status}
        </p>
      )}
      {reports.map((report) => (
        <Panel
          key={report.id}
          title={report.title}
          subtitle={`${report.module} · generated ${report.createdAt.slice(0, 19).replace('T', ' ')} · model ${report.modelVersion} · calculations ${report.calculationVersion}`}
          actions={
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() =>
                  setStatus(
                    downloadCsv(`${report.id}.csv`, reportToCsv(report))
                      ? 'Report exported as CSV'
                      : 'Export is unavailable in this environment',
                  )
                }
              >
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() =>
                  setStatus(
                    printHtml(reportToHtml(report))
                      ? 'Report opened for PDF printing'
                      : 'Printing is unavailable in this environment',
                  )
                }
              >
                Export PDF
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDelete(report.id)}>
                Delete
              </button>
            </>
          }
        >
          <DataTable
            caption={`${report.title} frozen values`}
            columns={['Section', 'Field', 'Value']}
            rows={[
              ...Object.entries(report.assumptions).map(([key, value]) => ({
                key: `assumption-${key}`,
                cells: ['Assumption', key, value === null ? 'n/a' : String(value)],
              })),
              ...Object.entries(report.snapshot).map(([key, value]) => ({
                key: `result-${key}`,
                cells: ['Result', key, value === null ? 'n/a' : String(value)],
              })),
            ]}
          />
          <ul className="provenance">
            {report.sources.map((source) => (
              <li key={`${source.provider}-${source.source}`}>{describeProvenance(source)}</li>
            ))}
          </ul>
        </Panel>
      ))}
      <Disclaimer>
        Reports keep the values that were calculated when they were saved, so historical research never silently
        changes when the underlying data is refreshed.
      </Disclaimer>
    </div>
  )
}
