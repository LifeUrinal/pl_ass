import { useState } from 'react'
import type { FieldSpec, ColumnMapping } from '../lib/parsers/mapping'

interface Props {
  title: string
  fields: FieldSpec[]
  headers: string[]
  initialMapping: ColumnMapping
  previewRows: Record<string, unknown>[]
  totalRowCount: number
  onConfirm: (mapping: ColumnMapping) => void
  onCancel: () => void
  onBack?: () => void
}

export default function ColumnMappingModal({ title, fields, headers, initialMapping, previewRows, totalRowCount, onConfirm, onCancel, onBack }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping)

  const missingRequired = fields.filter((f) => f.required && !mapping[f.key])

  function setField(key: string, header: string) {
    setMapping((m) => ({ ...m, [key]: header === '' ? null : header }))
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Bekreft kolonner – {title}</h2>
        <p className="muted">
          Vi har gjettet hvilke kolonner som hører til hvilket felt. Sjekk at det stemmer, og juster ved behov.
        </p>
        <div className="mapping-table">
          {fields.map((f) => (
            <div className="mapping-row" key={f.key}>
              <label htmlFor={`map-${f.key}`}>
                {f.label}
                {f.required && <span className="required">*</span>}
              </label>
              <select
                id={`map-${f.key}`}
                value={mapping[f.key] ?? ''}
                onChange={(e) => setField(f.key, e.target.value)}
              >
                <option value="">— ikke i bruk —</option>
                {headers.map((h, i) => (
                  <option key={`${h}-${i}`} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              {mapping[f.key] && previewRows[0] && (
                <span className="preview-value" title="Eksempelverdi fra første rad">
                  {String(previewRows[0][mapping[f.key] as string] ?? '')}
                </span>
              )}
            </div>
          ))}
        </div>
        {missingRequired.length > 0 && (
          <p className="error-text">
            Mangler obligatoriske felt: {missingRequired.map((f) => f.label).join(', ')}
          </p>
        )}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Avbryt
          </button>
          {onBack && (
            <button className="btn-tertiary" onClick={onBack}>
              ← Velg annet ark/rad
            </button>
          )}
          <button className="btn-primary" disabled={missingRequired.length > 0} onClick={() => onConfirm(mapping)}>
            Bekreft og importer ({totalRowCount} rader)
          </button>
        </div>
      </div>
    </div>
  )
}
