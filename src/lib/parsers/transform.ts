import type { ColumnMapping } from './mapping'
import { coerceDate, coerceNumber, toIsoDate, toIsoMonth, parseMonthHeader } from './mapping'
import type { ParsedSheet } from './sheet'
import type {
  BeslutningRad,
  EndringRad,
  EndringStatus,
  FakturaRad,
  FaktureringsplanRad,
  InnkjopRad,
  ProsjektinfoRad,
} from '../../types'

function getRaw(row: Record<string, unknown>, mapping: ColumnMapping, key: string): unknown {
  const header = mapping[key]
  if (!header) return undefined
  return row[header]
}

function str(row: Record<string, unknown>, mapping: ColumnMapping, key: string): string {
  const v = getRaw(row, mapping, key)
  return v === undefined || v === null ? '' : String(v).trim()
}

function num(row: Record<string, unknown>, mapping: ColumnMapping, key: string): number {
  return coerceNumber(getRaw(row, mapping, key))
}

function dateIso(row: Record<string, unknown>, mapping: ColumnMapping, key: string): string | undefined {
  return toIsoDate(coerceDate(getRaw(row, mapping, key)))
}

export function toFakturaRows(rows: Record<string, unknown>[], mapping: ColumnMapping): FakturaRad[] {
  return rows
    .map((r, i) => ({
      fakturanr: str(r, mapping, 'fakturanr') || `#${i + 1}`,
      leverandor: str(r, mapping, 'leverandor') || 'Ukjent leverandør',
      prodkode: str(r, mapping, 'prodkode') || undefined,
      belop: num(r, mapping, 'belop'),
      dato: dateIso(r, mapping, 'dato') ?? '',
      tekst: str(r, mapping, 'tekst') || undefined,
    }))
    .filter((r) => r.leverandor && (r.belop !== 0 || r.dato))
}

function normalizeStatus(raw: string): EndringStatus {
  const s = raw.toLowerCase()
  if (s.includes('godkjen') || s.includes('akseptert')) return 'Godkjent'
  if (s.includes('avslå') || s.includes('avslag') || s.includes('avvist')) return 'Avslått'
  if (s.includes('behandl') || s.includes('sendt') || s.includes('vurder')) return 'Til behandling'
  if (s.includes('utkast') || s.includes('kladd')) return 'Utkast'
  return raw ? 'Annet' : 'Til behandling'
}

export function toEndringRows(rows: Record<string, unknown>[], mapping: ColumnMapping): EndringRad[] {
  return rows
    .map((r, i) => ({
      id: str(r, mapping, 'id') || `E${i + 1}`,
      tittel: str(r, mapping, 'tittel') || `Endring ${i + 1}`,
      status: normalizeStatus(str(r, mapping, 'status')),
      belop: num(r, mapping, 'belop'),
      dato: dateIso(r, mapping, 'dato'),
      beskrivelse: str(r, mapping, 'beskrivelse') || undefined,
    }))
    .filter((r) => r.tittel)
}

export function toProsjektinfoRows(rows: Record<string, unknown>[], mapping: ColumnMapping): ProsjektinfoRad[] {
  return rows
    .map((r) => {
      const opprinneligBudsjett = num(r, mapping, 'opprinneligBudsjett')
      const revidertBudsjett = num(r, mapping, 'revidertBudsjett') || opprinneligBudsjett
      return {
        prodkode: str(r, mapping, 'prodkode'),
        betegnelse: str(r, mapping, 'betegnelse') || str(r, mapping, 'prodkode'),
        opprinneligBudsjett,
        revidertBudsjett,
        produsertVerdi: num(r, mapping, 'produsertVerdi'),
        paalopteKostnader: num(r, mapping, 'paalopteKostnader'),
        sluttkostPrognose: num(r, mapping, 'sluttkostPrognose') || revidertBudsjett,
      }
    })
    .filter((r) => r.prodkode)
}

export function toBeslutningRows(rows: Record<string, unknown>[], mapping: ColumnMapping): BeslutningRad[] {
  return rows
    .map((r, i) => ({
      id: str(r, mapping, 'id') || `B${i + 1}`,
      tema: str(r, mapping, 'tema') || `Avklaring ${i + 1}`,
      fristDato: dateIso(r, mapping, 'fristDato') ?? '',
      ansvarlig: str(r, mapping, 'ansvarlig') || undefined,
      status: str(r, mapping, 'status') || undefined,
      knyttetProdkode: str(r, mapping, 'knyttetProdkode') || undefined,
    }))
    .filter((r) => r.tema && r.fristDato)
}

export function toInnkjopRows(rows: Record<string, unknown>[], mapping: ColumnMapping): InnkjopRad[] {
  return rows
    .map((r, i) => ({
      id: str(r, mapping, 'id') || `I${i + 1}`,
      entreprise: str(r, mapping, 'entreprise') || `Innkjøp ${i + 1}`,
      prodkode: str(r, mapping, 'prodkode') || undefined,
      planlagtUtsendelseDato: dateIso(r, mapping, 'planlagtUtsendelseDato'),
      planlagtInnkjopsdato: dateIso(r, mapping, 'planlagtInnkjopsdato') ?? '',
      budsjett: num(r, mapping, 'budsjett') || undefined,
      status: str(r, mapping, 'status') || undefined,
    }))
    .filter((r) => r.entreprise && r.planlagtInnkjopsdato)
}

export function toFaktureringsplanRowsLong(rows: Record<string, unknown>[], mapping: ColumnMapping): FaktureringsplanRad[] {
  const byMonth = new Map<string, number>()
  for (const r of rows) {
    const month = toIsoMonth(coerceDate(getRaw(r, mapping, 'maned')))
    if (!month) continue
    const belop = num(r, mapping, 'planlagtBelop')
    byMonth.set(month, (byMonth.get(month) ?? 0) + belop)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([maned, planlagtBelop]) => ({ maned, planlagtBelop }))
}

/**
 * Prøver å tolke arket som en "bred" faktureringsplan: kolonneoverskrifter er
 * måneder, og hver rad (f.eks. per entreprise) har planlagt beløp i hver
 * månedskolonne. Returnerer null hvis ikke minst 3 kolonner ser ut som måneder.
 */
export function tryParseFaktureringsplanWide(sheet: ParsedSheet): FaktureringsplanRad[] | null {
  const monthByHeader = new Map<string, string>()
  for (const h of sheet.headers) {
    const m = parseMonthHeader(h)
    if (m) monthByHeader.set(h, m)
  }
  if (monthByHeader.size < 3) return null

  const byMonth = new Map<string, number>()
  for (const row of sheet.rows) {
    for (const [header, month] of monthByHeader) {
      const v = coerceNumber(row[header])
      byMonth.set(month, (byMonth.get(month) ?? 0) + v)
    }
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([maned, planlagtBelop]) => ({ maned, planlagtBelop }))
}
