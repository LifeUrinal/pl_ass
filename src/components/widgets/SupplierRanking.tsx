import type { LeverandorSum } from '../../lib/calculations'
import { formatKr, formatPercent } from '../../lib/calculations'

interface Props {
  leverandorer: LeverandorSum[]
}

export default function SupplierRanking({ leverandorer }: Props) {
  const max = leverandorer[0]?.sum ?? 1
  return (
    <section className="card">
      <h2>Størst leverandører</h2>
      <ul className="bar-list">
        {leverandorer.map((l) => (
          <li key={l.leverandor}>
            <div className="bar-list-header">
              <span>{l.leverandor}</span>
              <span>
                {formatKr(l.sum)} ({formatPercent(l.andelAvTotal)})
              </span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(l.sum / max) * 100}%` }} />
            </div>
            <div className="muted small">{l.antallFakturaer} fakturaer</div>
          </li>
        ))}
        {leverandorer.length === 0 && <li className="muted">Ingen fakturaer funnet.</li>}
      </ul>
    </section>
  )
}
