import { useRef, useState } from 'react'
import { REQUIRED_FILES } from '../types'
import type { ProjectDataSet, RawUploadedFile, RequiredFileKey } from '../types'
import { parseWorkbookFile, pickLargestSheet } from '../lib/parsers/sheet'
import type { ParsedSheet } from '../lib/parsers/sheet'
import { autoMapHeaders } from '../lib/parsers/mapping'
import type { ColumnMapping } from '../lib/parsers/mapping'
import { FIELD_SPECS } from '../lib/parsers/fieldSpecs'
import {
  toBeslutningRows,
  toEndringRows,
  toFakturaRows,
  toFaktureringsplanRowsLong,
  toInnkjopRows,
  toProsjektinfoRows,
  tryParseFaktureringsplanWide,
} from '../lib/parsers/transform'
import type { FaktureringsplanRad } from '../types'
import ColumnMappingModal from './ColumnMappingModal'
import WidePlanPreview from './WidePlanPreview'

interface Props {
  dataset: ProjectDataSet
  onFileImported: (key: RequiredFileKey, rows: unknown[], meta: RawUploadedFile) => void
  onContinue: () => void
}

type PendingMapping = {
  key: RequiredFileKey
  sheet: ParsedSheet
  mapping: ColumnMapping
  meta: RawUploadedFile
}

type PendingWide = {
  key: RequiredFileKey
  rows: FaktureringsplanRad[]
  sheet: ParsedSheet
  meta: RawUploadedFile
}

export default function UploadGate({ dataset, onFileImported, onContinue }: Props) {
  const [pendingMapping, setPendingMapping] = useState<PendingMapping | null>(null)
  const [pendingWide, setPendingWide] = useState<PendingWide | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<RequiredFileKey | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const allUploaded = REQUIRED_FILES.every((f) => dataset.meta[f.key])

  async function handleSelectFile(key: RequiredFileKey, file: File) {
    setBusy(key)
    setErrors((e) => ({ ...e, [key]: '' }))
    try {
      const wb = await parseWorkbookFile(file)
      const sheet = pickLargestSheet(wb)
      const meta: RawUploadedFile = {
        name: wb.fileName,
        sizeBytes: wb.sizeBytes,
        uploadedAt: new Date().toISOString(),
        sheetNames: wb.sheets.map((s) => s.sheetName),
      }
      if (sheet.rows.length === 0) {
        setErrors((e) => ({ ...e, [key]: 'Fant ingen datarader i filen. Sjekk at riktig ark og format er brukt.' }))
        setBusy(null)
        return
      }

      if (key === 'faktureringsplan') {
        const wide = tryParseFaktureringsplanWide(sheet)
        if (wide && wide.length > 0) {
          setPendingWide({ key, rows: wide, sheet, meta })
          setBusy(null)
          return
        }
      }

      const fields = FIELD_SPECS[key]
      const mapping = autoMapHeaders(sheet.headers, fields)
      setPendingMapping({ key, sheet, mapping, meta })
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: `Klarte ikke å lese filen: ${(err as Error).message}` }))
    } finally {
      setBusy(null)
    }
  }

  function confirmMapping(mapping: ColumnMapping) {
    if (!pendingMapping) return
    const { key, sheet, meta } = pendingMapping
    const rows = mapRowsForKey(key, sheet.rows, mapping)
    onFileImported(key, rows, meta)
    setPendingMapping(null)
  }

  function confirmWide() {
    if (!pendingWide) return
    onFileImported(pendingWide.key, pendingWide.rows, pendingWide.meta)
    setPendingWide(null)
  }

  function switchWideToManual() {
    if (!pendingWide) return
    const { key, sheet, meta } = pendingWide
    const fields = FIELD_SPECS[key]
    const mapping = autoMapHeaders(sheet.headers, fields)
    setPendingMapping({ key, sheet, mapping, meta })
    setPendingWide(null)
  }

  return (
    <div className="upload-gate">
      <header className="upload-header">
        <h1>Prosjektøkonomi</h1>
        <p>
          For å komme i gang må de følgende filene lastes opp. Alle filer eksporteres som Excel (.xlsx) eller CSV
          fra prosjektsystemet/regnskapet.
        </p>
      </header>

      <div className="upload-grid">
        {REQUIRED_FILES.map((f, i) => {
          const meta = dataset.meta[f.key]
          return (
            <div className={`upload-card ${meta ? 'done' : ''}`} key={f.key}>
              <div className="upload-card-number">{i + 1}</div>
              <div className="upload-card-body">
                <h3>{f.label}</h3>
                <p>{f.description}</p>
                {meta ? (
                  <div className="upload-status">
                    ✓ {meta.name} ({(meta.sizeBytes / 1024).toFixed(0)} kB)
                  </div>
                ) : (
                  <div className="upload-status muted">Ikke lastet opp</div>
                )}
                {errors[f.key] && <div className="error-text">{errors[f.key]}</div>}
                <input
                  ref={(el) => {
                    inputRefs.current[f.key] = el
                  }}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleSelectFile(f.key, file)
                    e.target.value = ''
                  }}
                />
                <button
                  className="btn-secondary"
                  disabled={busy === f.key}
                  onClick={() => inputRefs.current[f.key]?.click()}
                >
                  {busy === f.key ? 'Leser fil…' : meta ? 'Bytt fil' : 'Last opp fil'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="upload-footer">
        <button className="btn-primary btn-large" disabled={!allUploaded} onClick={onContinue}>
          {allUploaded ? 'Gå til oversikt' : `${REQUIRED_FILES.filter((f) => dataset.meta[f.key]).length} av ${REQUIRED_FILES.length} filer lastet opp`}
        </button>
      </div>

      {pendingMapping && (
        <ColumnMappingModal
          title={REQUIRED_FILES.find((f) => f.key === pendingMapping.key)!.label}
          fields={FIELD_SPECS[pendingMapping.key]}
          headers={pendingMapping.sheet.headers}
          initialMapping={pendingMapping.mapping}
          previewRows={pendingMapping.sheet.rows.slice(0, 5)}
          totalRowCount={pendingMapping.sheet.rows.length}
          onConfirm={confirmMapping}
          onCancel={() => setPendingMapping(null)}
        />
      )}

      {pendingWide && (
        <WidePlanPreview
          rows={pendingWide.rows}
          onConfirm={confirmWide}
          onUseManualMapping={switchWideToManual}
          onCancel={() => setPendingWide(null)}
        />
      )}
    </div>
  )
}

function mapRowsForKey(key: RequiredFileKey, rows: Record<string, unknown>[], mapping: ColumnMapping): unknown[] {
  switch (key) {
    case 'fakturaer':
      return toFakturaRows(rows, mapping)
    case 'endringslogg':
      return toEndringRows(rows, mapping)
    case 'prosjektinfo':
      return toProsjektinfoRows(rows, mapping)
    case 'faktureringsplan':
      return toFaktureringsplanRowsLong(rows, mapping)
    case 'beslutningsplan':
      return toBeslutningRows(rows, mapping)
    case 'innkjopsplan':
      return toInnkjopRows(rows, mapping)
  }
}
