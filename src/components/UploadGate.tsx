import { useRef, useState } from 'react'
import { REQUIRED_FILES } from '../types'
import type { ProjectDataSet, RawUploadedFile, RequiredFileKey } from '../types'
import { buildParsedSheet, guessHeaderRowIndex, parseWorkbookFile, pickLargestSheetIndex } from '../lib/parsers/sheet'
import type { ParsedSheet, ParsedWorkbook } from '../lib/parsers/sheet'
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
  tryParseBetalingsplanPivot,
  tryParseFaktureringsplanWide,
} from '../lib/parsers/transform'
import type { FaktureringsplanRad } from '../types'
import SheetHeaderPicker from './SheetHeaderPicker'
import ColumnMappingModal from './ColumnMappingModal'
import WidePlanPreview from './WidePlanPreview'

interface Props {
  dataset: ProjectDataSet
  onFileImported: (key: RequiredFileKey, rows: unknown[], meta: RawUploadedFile) => void
  onContinue: () => void
}

type PendingSheetPick = {
  key: RequiredFileKey
  workbook: ParsedWorkbook
  meta: RawUploadedFile
  sheetIndex: number
  headerRowIndex: number
}

type PendingMapping = {
  key: RequiredFileKey
  workbook: ParsedWorkbook
  sheet: ParsedSheet
  sheetIndex: number
  headerRowIndex: number
  mapping: ColumnMapping
  meta: RawUploadedFile
}

type PendingWide = {
  key: RequiredFileKey
  workbook: ParsedWorkbook
  rows: FaktureringsplanRad[]
  sheet: ParsedSheet
  sheetIndex: number
  headerRowIndex: number
  meta: RawUploadedFile
}

export default function UploadGate({ dataset, onFileImported, onContinue }: Props) {
  const [pendingSheetPick, setPendingSheetPick] = useState<PendingSheetPick | null>(null)
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
      const workbook = await parseWorkbookFile(file)
      if (workbook.sheets.every((s) => s.matrix.length === 0)) {
        setErrors((e) => ({ ...e, [key]: 'Fant ingen data i filen.' }))
        setBusy(null)
        return
      }
      const meta: RawUploadedFile = {
        name: workbook.fileName,
        sizeBytes: workbook.sizeBytes,
        uploadedAt: new Date().toISOString(),
        sheetNames: workbook.sheets.map((s) => s.sheetName),
      }
      const sheetIndex = pickLargestSheetIndex(workbook)
      const headerRowIndex = guessHeaderRowIndex(workbook.sheets[sheetIndex].matrix)
      setPendingSheetPick({ key, workbook, meta, sheetIndex, headerRowIndex })
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: `Klarte ikke å lese filen: ${(err as Error).message}` }))
    } finally {
      setBusy(null)
    }
  }

  function confirmSheetPick(sheetIndex: number, headerRowIndex: number) {
    if (!pendingSheetPick) return
    const { key, workbook, meta } = pendingSheetPick
    const rawSheet = workbook.sheets[sheetIndex]
    const sheet = buildParsedSheet(rawSheet.sheetName, rawSheet.matrix, headerRowIndex)
    setPendingSheetPick(null)

    if (key === 'faktureringsplan') {
      const pivot = tryParseBetalingsplanPivot(sheet)
      const wide = pivot && pivot.length > 0 ? pivot : tryParseFaktureringsplanWide(sheet)
      if (wide && wide.length > 0) {
        setPendingWide({ key, workbook, rows: wide, sheet, sheetIndex, headerRowIndex, meta })
        return
      }
    }

    const fields = FIELD_SPECS[key]
    const mapping = autoMapHeaders(sheet.headers, fields)
    setPendingMapping({ key, workbook, sheet, sheetIndex, headerRowIndex, mapping, meta })
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
    const { key, workbook, sheet, sheetIndex, headerRowIndex, meta } = pendingWide
    const fields = FIELD_SPECS[key]
    const mapping = autoMapHeaders(sheet.headers, fields)
    setPendingMapping({ key, workbook, sheet, sheetIndex, headerRowIndex, mapping, meta })
    setPendingWide(null)
  }

  function backToSheetPickFromMapping() {
    if (!pendingMapping) return
    const { key, workbook, meta, sheetIndex, headerRowIndex } = pendingMapping
    setPendingMapping(null)
    setPendingSheetPick({ key, workbook, meta, sheetIndex, headerRowIndex })
  }

  function backToSheetPickFromWide() {
    if (!pendingWide) return
    const { key, workbook, meta, sheetIndex, headerRowIndex } = pendingWide
    setPendingWide(null)
    setPendingSheetPick({ key, workbook, meta, sheetIndex, headerRowIndex })
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

      {pendingSheetPick && (
        <SheetHeaderPicker
          title={REQUIRED_FILES.find((f) => f.key === pendingSheetPick.key)!.label}
          workbook={pendingSheetPick.workbook}
          initialSheetIndex={pendingSheetPick.sheetIndex}
          initialHeaderRowIndex={pendingSheetPick.headerRowIndex}
          onConfirm={confirmSheetPick}
          onCancel={() => setPendingSheetPick(null)}
        />
      )}

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
          onBack={backToSheetPickFromMapping}
        />
      )}

      {pendingWide && (
        <WidePlanPreview
          rows={pendingWide.rows}
          onConfirm={confirmWide}
          onUseManualMapping={switchWideToManual}
          onCancel={() => setPendingWide(null)}
          onBack={backToSheetPickFromWide}
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
