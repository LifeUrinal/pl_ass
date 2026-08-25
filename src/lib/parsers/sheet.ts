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
    const headerRow = (matrix[headerRowIndex] ?? []).map((h) => {
      if (h instanceof Date && !isNaN(h.getTime())) return toIsoMonth(h) ?? normalizeHeader(String(h))
      return normalizeHeader(String(h ?? ''))
    })
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

/** Velger arket med flest rader (som regel det relevante datarket). */
export function pickLargestSheet(wb: ParsedWorkbook): ParsedSheet {
  return [...wb.sheets].sort((a, b) => b.rows.length - a.rows.length)[0]
}
