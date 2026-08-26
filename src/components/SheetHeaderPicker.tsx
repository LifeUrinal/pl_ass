import { useMemo, useState } from 'react'
import type { ParsedWorkbook } from '../lib/parsers/sheet'
import { buildParsedSheet, cellText, guessHeaderRowIndex } from '../lib/parsers/sheet'

interface Props {
  title: string
  workbook: ParsedWorkbook
  initialSheetIndex: number
  initialHeaderRowIndex: number
  onConfirm: (sheetIndex: number, headerRowIndex: number) => void
  onCancel: () => void
}

const MAX_PREVIEW_ROWS = 40
const MAX_PREVIEW_COLS = 25

export default function SheetHeaderPicker({
  title,
  workbook,
  initialSheetIndex,
  initialHeaderRowIndex,
  onConfirm,
  onCancel,
}: Props) {
  const [sheetIndex, setSheetIndex] = useState(initialSheetIndex)
  const [headerRowIndex, setHeaderRowIndex] = useState(initialHeaderRowIndex)
  const sheet = workbook.sheets[sheetIndex]

  function selectSheet(i: number) {
    setSheetIndex(i)
    setHeaderRowIndex(guessHeaderRowIndex(workbook.sheets[i].matrix))
  }

  const preview = useMemo(
    () => buildParsedSheet(sheet.sheetName, sheet.matrix, headerRowIndex),
    [sheet, headerRowIndex],
  )

  const rowsToShow = Math.min(sheet.matrix.length, MAX_PREVIEW_ROWS)
  const colCount = Math.min(Math.max(...sheet.matrix.slice(0, rowsToShow).map((r) => r.length), 1), MAX_PREVIEW_COLS)

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide">
        <h2>Velg ark og overskriftsrad – {title}</h2>
        <p className="muted">
          Vi har foreslått en rad som overskrift, men eksportfiler er ofte satt opp forskjellig – tittel-/
          metadatarader øverst, eller totrinns overskrifter. Sjekk rutenettet under: klikk på raden som faktisk
          inneholder kolonneoverskriftene (f.eks. "Måned", "Beløp", prodkoder e.l.), og se at gjenkjente kolonner og
          antall datarader under stemmer.
        </p>

        {workbook.sheets.length > 1 && (
          <div className="sheet-select-row">
            <label htmlFor="sheet-select">Ark</label>
            <select id="sheet-select" value={sheetIndex} onChange={(e) => selectSheet(Number(e.target.value))}>
              {workbook.sheets.map((s, i) => (
                <option key={s.sheetName} value={i}>
                  {s.sheetName} ({s.matrix.length} rader)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="table-scroll grid-preview">
          <table className="data-table compact">
            <tbody>
              {sheet.matrix.slice(0, rowsToShow).map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={rowIndex === headerRowIndex ? 'header-row-selected' : ''}
                  onClick={() => setHeaderRowIndex(rowIndex)}
                >
                  <td className="row-picker-cell">
                    <input
                      type="radio"
                      name="header-row"
                      checked={rowIndex === headerRowIndex}
                      onChange={() => setHeaderRowIndex(rowIndex)}
                    />
                    <span className="row-index">{rowIndex + 1}</span>
                  </td>
                  {Array.from({ length: colCount }).map((_, colIndex) => (
                    <td key={colIndex}>{cellText(row[colIndex])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sheet.matrix.length > MAX_PREVIEW_ROWS && (
          <p className="muted small">
            Viser de {MAX_PREVIEW_ROWS} første radene av {sheet.matrix.length} totalt.
          </p>
        )}

        <div className="preview-result">
          {preview.headers.length === 0 ? (
            <p className="error-text">Fant ingen kolonneoverskrifter i denne raden. Velg en annen rad.</p>
          ) : (
            <>
              <p>
                <strong>Gjenkjente kolonner ({preview.headers.length}):</strong> {preview.headers.join(', ')}
              </p>
              <p>
                <strong>Datarader funnet:</strong> {preview.rows.length}
              </p>
              {preview.rows.length === 0 && (
                <p className="error-text">Ingen datarader under denne raden. Sjekk at riktig rad og ark er valgt.</p>
              )}
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel}>
            Avbryt
          </button>
          <button
            className="btn-primary"
            disabled={preview.headers.length === 0 || preview.rows.length === 0}
            onClick={() => onConfirm(sheetIndex, headerRowIndex)}
          >
            Bruk denne raden som overskrift
          </button>
        </div>
      </div>
    </div>
  )
}
