import type { EndringOversikt } from '../../lib/calculations'
import { formatKr } from '../../lib/calculations'

interface Props {
  endringer: EndringOversikt
}

const STATUS_CLASS: Record<string, string> = {
  Godkjent: 'pill-ok',
  Avslått: 'pill-danger',
  'Til behandling': 'pill-warn',
  Utkast: 'pill-muted',
  Annet: 'pill-muted',
}

export default function ChangeLogSummary({ endringer }: Props) {
  return (
    <section className="card">
      <h2>Endringer mot byggherre</h2>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Antall endringer</div>
          <div className="stat-value">{endringer.totalAntall}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Sum alle endringer</div>
          <div className="stat-value">{formatKr(endringer.totalSum)}</div>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Antall</th>
            <th>Sum</th>
          </tr>
        </thead>
        <tbody>
          {endringer.perStatus.map((s) => (
            <tr key={s.status}>
              <td>
                <span className={`pill ${STATUS_CLASS[s.status] ?? 'pill-muted'}`}>{s.status}</span>
              </td>
              <td>{s.antall}</td>
              <td>{formatKr(s.sum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
