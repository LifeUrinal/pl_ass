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
 * objekter nøkkelsatt på kolonneoverskrift. Overskriftsraden gjettes automatisk
 * (se guessHeaderRowIndex), men brukeren kan overstyre både ark og overskriftsrad
 * i grensesnittet – se buildParsedSheet, som brukes til det.
 */
export async function parseWorkbookFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
    return buildParsedSheet(sheetName, matrix, guessHeaderRowIndex(matrix))
  })

  return { fileName: file.name, sizeBytes: file.size, sheets }
}

/**
 * Gjetter hvilken rad som mest sannsynlig er overskriftsraden: blant de
 * første radene, den som har flest tekst-/dato-celler (ekte overskrifter er
 * som regel tekst), fremfor en rad som bare har flest utfylte celler totalt
 * (som ofte er en datarad med mange tall – f.eks. en fordelingsrad med
 * prosentandeler, som ellers lett vinner over den ekte overskriftsraden).
 */
export function guessHeaderRowIndex(matrix: unknown[][]): number {
  const limit = Math.min(matrix.length, 25)
  let bestIndex = 0
  let bestScore = -1
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? []
    const nonEmpty = row.filter((c) => c !== '' && c !== null && c !== undefined)
    if (nonEmpty.length < 2) continue
    const textOrDateCells = nonEmpty.filter(
      (c) => c instanceof Date || (typeof c === 'string' && isNaN(Number(c.replace(',', '.')))),
    )
    const score = textOrDateCells.length * 3 + nonEmpty.length
    if (score > bestScore) {
      bestScore = score
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

/** Tekstvisning av en celle, brukt i rutenett-forhåndsvisning i grensesnittet. */
export function cellText(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return toIsoMonth(v) ?? v.toLocaleDateString('nb-NO')
  if (v === null || v === undefined) return ''
  return String(v)
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

/**
 * Bygger en ferdig ParsedSheet (kolonneoverskrifter + rader som objekter) fra
 * en rå matrise, gitt hvilken rad som er overskriftsrad. Brukes både til den
 * automatiske gjetningen og når brukeren velger ark/overskriftsrad manuelt,
 * slik at resultatet blir identisk uansett hvordan raden ble valgt.
 */
export function buildParsedSheet(sheetName: string, matrix: unknown[][], headerRowIndex: number): ParsedSheet {
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
}

/** Velger arket med flest rader (som regel det relevante datarket). */
export function pickLargestSheet(wb: ParsedWorkbook): ParsedSheet {
  return [...wb.sheets].sort((a, b) => b.rows.length - a.rows.length)[0]
}

/** Samme som pickLargestSheet, men returnerer indeksen i wb.sheets. */
export function pickLargestSheetIndex(wb: ParsedWorkbook): number {
  let bestIndex = 0
  let bestCount = -1
  wb.sheets.forEach((s, i) => {
    if (s.rows.length > bestCount) {
      bestCount = s.rows.length
      bestIndex = i
    }
  })
  return bestIndex
}
