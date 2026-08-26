import * as XLSX from 'xlsx'
import { toIsoMonth } from './mapping'

export interface ParsedSheet {
  sheetName: string
  headers: string[]
  rows: Record<string, unknown>[]
  /** Rå cellematrise (rad for rad, som i regnearket), til bruk for ark med flere overskriftsrader. */
  matrix: unknown[][]
}

export interface ParsedWorkbook {
  fileName: string
  sizeBytes: number
  sheets: ParsedSheet[]
}

/**
 * Leser en opplastet fil (xlsx/xls/csv) og returnerer alle ark som rader av
 * objekter nøkkelsatt på kolonneoverskrift. Overskriftsraden gjettes som den
 * første raden som har flest ikke-tomme celler blant de 5 første radene,
 * siden mange eksportfiler har tittel-/metadatarader øverst.
 */
export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
    const headerRowIndex = guessHeaderRowIndex(matrix)
    const headerRow = buildHeaderRow(matrix, headerRowIndex)
    const dataRows = matrix.slice(headerRowIndex + 1)

    const rows: Record<string, unknown>[] = dataRows
      .filter((r) => r.some((cell) => cell !== '' && cell !== null && cell !== undefined))
      .map((r) => {
        const obj: Record<string, unknown> = {}
        headerRow.forEach((h, i) => {
          if (!h) return
          obj[h] = r[i]
        })
        return obj
      })

    return { sheetName, headers: headerRow.filter(Boolean), rows, matrix }
  })

  return { fileName: file.name, sizeBytes: file.size, sheets }
}

function guessHeaderRowIndex(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 6)
  let bestIndex = 0
  let bestCount = -1
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? []
    const nonEmpty = row.filter((c) => c !== '' && c !== null && c !== undefined).length
    if (nonEmpty > bestCount) {
      bestCount = nonEmpty
      bestIndex = i
    }
  }
  return bestIndex
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, ' ')
}

function cellToHeaderLabel(h: unknown): string {
  if (h instanceof Date && !isNaN(h.getTime())) return toIsoMonth(h) ?? normalizeHeader(String(h))
  return normalizeHeader(String(h ?? ''))
}

/**
 * Bygger overskriftsraden for arket. Enkelte maler har en gruppeoverskrift
 * rett over selve kolonneoverskriften, f.eks. "Beslutning" som overskrift
 * for underkolonnene "Ansvar"/"Frist"/"Status" – disse underkolonnene
 * gjentar seg ofte for flere grupper (Leveransebeskrivelse/Beslutningsunderlag/
 * Beslutning). Rå overskrifter ville da enten kollidert (samme nøkkel
 * "Frist" flere ganger, så bare siste overlever) eller blitt tomme for
 * kolonner uten egen underoverskrift (f.eks. "Tema", "Henvisning/kommentar").
 * Vi kombinerer derfor gruppe- og underoverskrift til f.eks. "Beslutning Frist"
 * når raden over ser ut som en reell gruppeoverskrift (minst 2 utfylte celler).
 */
function buildHeaderRow(matrix: unknown[][], headerRowIndex: number): string[] {
  const rawLabels = (matrix[headerRowIndex] ?? []).map(cellToHeaderLabel)

  const seen = new Set<string>()
  const hasDuplicates = rawLabels.some((l) => {
    if (!l) return false
    if (seen.has(l)) return true
    seen.add(l)
    return false
  })
  const firstNonEmpty = rawLabels.findIndex(Boolean)
  const lastNonEmpty = rawLabels.length - 1 - [...rawLabels].reverse().findIndex(Boolean)
  const hasGapsWithinSpan =
    firstNonEmpty !== -1 && rawLabels.slice(firstNonEmpty, lastNonEmpty + 1).some((l) => !l)

  if (!hasDuplicates && !hasGapsWithinSpan) return rawLabels

  const groupRowIndex = headerRowIndex - 1
  const groupRawRow = matrix[groupRowIndex]
  if (!groupRawRow) return rawLabels
  const groupLabels = groupRawRow.map(cellToHeaderLabel)
  if (groupLabels.filter(Boolean).length < 2) return rawLabels

  const filledGroup: string[] = []
  let current = ''
  for (let c = 0; c < Math.max(rawLabels.length, groupLabels.length); c++) {
    if (groupLabels[c]) current = groupLabels[c]
    filledGroup[c] = current
  }

  return rawLabels.map((label, c) => {
    const group = filledGroup[c] ?? ''
    if (!label) return group
    if (group && group !== label) return `${group} ${label}`
    return label
  })
}

/** Velger arket med flest rader (som regel det relevante datarket). */
export function pickLargestSheet(wb: ParsedWorkbook): ParsedSheet {
  return [...wb.sheets].sort((a, b) => b.rows.length - a.rows.length)[0]
}
