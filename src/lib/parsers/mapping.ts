export type FieldType = 'string' | 'number' | 'date'

export interface FieldSpec {
  key: string
  label: string
  synonyms: string[] // små bokstaver, brukes til automatisk gjenkjenning av kolonneoverskrift
  required: boolean
  type: FieldType
}

export type ColumnMapping = Record<string, string | null> // fieldKey -> header (eller null = ikke i bruk)

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Prøver å automatisk matche kolonneoverskrifter mot feltspesifikasjonene. */
export function autoMapHeaders(headers: string[], fields: FieldSpec[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const remaining = new Set(headers)

  const ordered = [...fields].sort((a, b) => Number(b.required) - Number(a.required))

  for (const field of ordered) {
    let bestHeader: string | null = null
    let bestScore = 0
    for (const header of remaining) {
      const normHeader = normalize(header)
      for (const syn of field.synonyms) {
        const normSyn = normalize(syn)
        if (!normSyn) continue
        let score = 0
        if (normHeader === normSyn) score = normSyn.length + 100
        else if (normHeader.includes(normSyn)) score = normSyn.length + 10
        else if (normSyn.includes(normHeader) && normHeader.length > 2) score = normHeader.length
        if (score > bestScore) {
          bestScore = score
          bestHeader = header
        }
      }
    }
    if (bestHeader) {
      mapping[field.key] = bestHeader
      remaining.delete(bestHeader)
    } else {
      mapping[field.key] = null
    }
  }
  return mapping
}

export function coerceNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return isFinite(value) ? value : 0
  let s = String(value).trim()
  if (!s) return 0
  s = s.replace(/kr|nok/gi, '').trim()
  const isNegParen = /^\(.*\)$/.test(s)
  if (isNegParen) s = s.slice(1, -1)
  // Fjern tusenskilletegn (mellomrom eller punktum) og bruk komma som desimaltegn -> punktum
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // Anta punktum = tusenskille, komma = desimal (norsk format)
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    s = s.replace(/\s/g, '').replace(',', '.')
  } else {
    s = s.replace(/\s/g, '')
  }
  s = s.replace(/[^\d.-]/g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return isNegParen ? -n : n
}

const MONTHS_NO: Record<string, number> = {
  jan: 1, januar: 1,
  feb: 2, februar: 2,
  mar: 3, mars: 3,
  apr: 4, april: 4,
  mai: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, november: 11,
  des: 12, desember: 12,
}

/** Returnerer en Date, eller null hvis verdien ikke lot seg tolke som dato. */
export function coerceDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    // Excel-serienummer (dager siden 1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30))
    const d = new Date(epoch.getTime() + value * 86400000)
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(value).trim()
  if (!s) return null

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))

  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/)
  if (m) {
    let year = Number(m[3])
    if (year < 100) year += 2000
    return new Date(year, Number(m[2]) - 1, Number(m[1]))
  }

  m = s.match(/^([a-zæøå]+)[.\-\s]?\s*'?(\d{2,4})$/i)
  if (m) {
    const monthKey = normalize(m[1]).replace('.', '')
    const monthNum = MONTHS_NO[monthKey]
    if (monthNum) {
      let year = Number(m[2])
      if (year < 100) year += 2000
      return new Date(year, monthNum - 1, 1)
    }
  }

  const parsed = Date.parse(s)
  if (!isNaN(parsed)) return new Date(parsed)
  return null
}

export function toIsoDate(d: Date | null): string | undefined {
  if (!d) return undefined
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toIsoMonth(d: Date | null): string | undefined {
  if (!d) return undefined
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Prøver å tolke en kolonneoverskrift som en måned/dato-etikett (for "bred" faktureringsplan). */
export function parseMonthHeader(header: string): string | null {
  const d = coerceDate(header)
  if (!d) return null
  return toIsoMonth(d) ?? null
}
