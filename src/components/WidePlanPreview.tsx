import type { FaktureringsplanRad } from '../types'
import { formatKr } from '../lib/calculations'

interface Props {
  rows: FaktureringsplanRad[]
  onConfirm: () => void
  onUseManualMapping: () => void
  onCancel: () => void
}

export default function WidePlanPreview({ rows, onConfirm, onUseManualMapping, onCancel }: Props) {
  const total = rows.reduce((s, r) => s + r.planlagtBelop, 0)
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Faktureringsplan gjenkjent</h2>
        <p className="muted">
          Vi fant {rows.length} måneder med planlagt fakturering, fra {rows[0]?.maned} til {rows[rows.length - 1]?.maned}, totalt {formatKr(total)}.
        </p>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Måned</th>
                <th>Planlagt beløp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.maned}>
                  <td>{r.maned}</td>
                  <td>{formatKr(r.planlagtBelop)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Avbryt
          </button>
          <button className="btn-tertiary" onClick={onUseManualMapping}>
            Dette stemmer ikke – velg kolonner manuelt
          </button>
          <button className="btn-primary" onClick={onConfirm}>
            Bekreft og bruk denne planen
          </button>
        </div>
      </div>
    </div>
  )
}
