import { useState } from 'react'
import type { ProdkodeAnalyse } from '../../lib/calculations'
import { formatKr, formatPercent } from '../../lib/calculations'

interface Props {
  prodkoder: ProdkodeAnalyse[]
}

export default function ProdkodeReconciliation({ prodkoder }: Props) {
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const flaggedCount = prodkoder.filter((p) => p.flagg.length > 0).length
  const rows = onlyFlagged ? prodkoder.filter((p) => p.flagg.length > 0) : prodkoder

  return (
    <section className="card">
      <div className="card-header-row">
        <h2>Avstemming per prodkode</h2>
        {flaggedCount > 0 && (
          <label className="toggle">
            <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
            Vis kun flagget ({flaggedCount})
          </label>
        )}
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Prodkode</th>
              <th>Betegnelse</th>
              <th>Budsjett</th>
              <th>Påløpt</th>
              <th>Andel brukt</th>
              <th>Sluttkostprognose</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.prodkode} className={p.flagg.length > 0 ? 'flagged-row' : ''}>
                <td>{p.prodkode}</td>
                <td>{p.betegnelse}</td>
                <td>{formatKr(p.budsjett)}</td>
                <td>{formatKr(p.paalopt)}</td>
                <td>{formatPercent(p.paaloptAndel)}</td>
                <td>{formatKr(p.sluttkostPrognose)}</td>
                <td>
                  {p.flagg.length === 0 ? (
                    <span className="pill pill-ok">OK</span>
                  ) : (
                    <div className="flag-list">
                      {p.flagg.map((f, i) => (
                        <span className="pill pill-warn" key={i} title={f.melding}>
                          ⚠ {f.type === 'PROGNOSE_OVER_BUDSJETT' ? 'Prognose > budsjett' : 'Forbrukstakt for høy'}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {flaggedCount > 0 && (
        <ul className="flag-detail-list">
          {prodkoder
            .filter((p) => p.flagg.length > 0)
            .map((p) =>
              p.flagg.map((f, i) => (
                <li key={`${p.prodkode}-${i}`}>
                  <strong>
                    {p.prodkode} – {p.betegnelse}:
                  </strong>{' '}
                  {f.melding}
                </li>
              )),
            )}
        </ul>
      )}
    </section>
  )
}
