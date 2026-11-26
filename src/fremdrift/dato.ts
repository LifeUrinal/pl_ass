// Enkle datofunksjoner basert på "dagnummer" (dager siden 1970-01-01, UTC),
// slik at vi slipper tidssone- og sommertidsproblemer.

const MS_PER_DAG = 86_400_000

export function tilDag(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAG)
}

export function fraDag(dag: number): string {
  return new Date(dag * MS_PER_DAG).toISOString().slice(0, 10)
}

export function iDag(): string {
  const n = new Date()
  return fraDag(Math.round(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / MS_PER_DAG))
}

export function leggTilDager(iso: string, n: number): string {
  return fraDag(tilDag(iso) + n)
}

/** 0 = mandag … 6 = søndag */
export function ukedag(dag: number): number {
  return (new Date(dag * MS_PER_DAG).getUTCDay() + 6) % 7
}

export function erHelg(dag: number): boolean {
  return ukedag(dag) >= 5
}

export function antallDager(start: string, slutt: string): number {
  return tilDag(slutt) - tilDag(start) + 1
}

// --- Norske helligdager -----------------------------------------------------

/** Påskedag (1. påskedag) for et år, som dagnummer. Gregoriansk algoritme (Meeus/Jones/Butcher). */
function paskedag(ar: number): number {
  const a = ar % 19
  const b = Math.floor(ar / 100)
  const c = ar % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mnd = Math.floor((h + l - 7 * m + 114) / 31)
  const dag = ((h + l - 7 * m + 114) % 31) + 1
  return Math.round(Date.UTC(ar, mnd - 1, dag) / MS_PER_DAG)
}

const helligdagCache = new Map<number, Map<number, string>>()

/** Alle offentlige høytidsdager i Norge for et år (dagnummer → navn). */
export function helligdagerForAr(ar: number): Map<number, string> {
  let m = helligdagCache.get(ar)
  if (m) return m
  const fast = (mnd: number, dag: number) => Math.round(Date.UTC(ar, mnd - 1, dag) / MS_PER_DAG)
  const p = paskedag(ar)
  m = new Map<number, string>([
    [fast(1, 1), 'Nyttårsdag'],
    [p - 3, 'Skjærtorsdag'],
    [p - 2, 'Langfredag'],
    [p, '1. påskedag'],
    [p + 1, '2. påskedag'],
    [fast(5, 1), 'Arbeidernes dag'],
    [fast(5, 17), 'Grunnlovsdag'],
    [p + 39, 'Kristi himmelfartsdag'],
    [p + 49, '1. pinsedag'],
    [p + 50, '2. pinsedag'],
    [fast(12, 25), '1. juledag'],
    [fast(12, 26), '2. juledag'],
  ])
  helligdagCache.set(ar, m)
  return m
}

/** Navnet på helligdagen, eller undefined om dagen ikke er en helligdag. */
export function helligdag(dag: number): string | undefined {
  return helligdagerForAr(new Date(dag * MS_PER_DAG).getUTCFullYear()).get(dag)
}

// --- Valgfrie fridager (per prosjekt) -----------------------------------------

export interface FridagValg {
  /** Fellesferie: tre uker fra og med uke `fellesferieStartUke` */
  fellesferie: boolean
  fellesferieStartUke: number
  /** Julaften (24.12) og nyttårsaften (31.12) */
  julOgNyttarsaften: boolean
}

export const STANDARD_FRIDAGER: FridagValg = { fellesferie: false, fellesferieStartUke: 28, julOgNyttarsaften: false }
export const FELLESFERIE_UKER = 3

/**
 * Navnet på fridagen (helligdag eller valgt fridag), eller undefined for en vanlig dag.
 * Helger regnes ikke med her – de håndteres for seg.
 */
export function fridag(dag: number, valg: FridagValg = STANDARD_FRIDAGER): string | undefined {
  const h = helligdag(dag)
  if (h) return h
  if (valg.julOgNyttarsaften) {
    const { mnd, dag: dd } = delerAvDag(dag)
    if (mnd === 11 && dd === 24) return 'Julaften'
    if (mnd === 11 && dd === 31) return 'Nyttårsaften'
  }
  if (valg.fellesferie) {
    const { mnd } = delerAvDag(dag)
    const uke = ukenummer(dag)
    if (mnd >= 5 && mnd <= 7 && uke >= valg.fellesferieStartUke && uke < valg.fellesferieStartUke + FELLESFERIE_UKER) return 'Fellesferie'
  }
  return undefined
}

/** Fridag = lørdag, søndag, helligdag eller valgt fridag. */
export function erFridag(dag: number, valg: FridagValg = STANDARD_FRIDAGER): boolean {
  return erHelg(dag) || fridag(dag, valg) !== undefined
}

/** Antall arbeidsdager (man–fre, minus helligdager og valgte fridager) i perioden, begge dager medregnet. */
export function arbeidsdager(start: string, slutt: string, valg: FridagValg = STANDARD_FRIDAGER): number {
  let n = 0
  for (let d = tilDag(start); d <= tilDag(slutt); d++) if (!erFridag(d, valg)) n++
  return n
}

/**
 * Fridager som faller på en hverdag i perioden (de som faktisk «koster» en arbeidsdag),
 * slått sammen per navn – f.eks. «Fellesferie» med 15 dager.
 */
export function fridagerIPeriode(start: string, slutt: string, valg: FridagValg = STANDARD_FRIDAGER): { navn: string; fra: string; til: string; antall: number }[] {
  const ut: { navn: string; fra: string; til: string; antall: number }[] = []
  for (let d = tilDag(start); d <= tilDag(slutt); d++) {
    const navn = fridag(d, valg)
    if (!navn || erHelg(d)) continue
    const siste = ut[ut.length - 1]
    if (siste && siste.navn === navn && tilDag(siste.til) >= d - 4) {
      siste.til = fraDag(d)
      siste.antall++
    } else ut.push({ navn, fra: fraDag(d), til: fraDag(d), antall: 1 })
  }
  return ut
}

/** ISO-ukenummer */
export function ukenummer(dag: number): number {
  const torsdag = dag - ukedag(dag) + 3
  const dato = new Date(torsdag * MS_PER_DAG)
  const arStart = Math.round(Date.UTC(dato.getUTCFullYear(), 0, 1) / MS_PER_DAG)
  return Math.floor((torsdag - arStart) / 7) + 1
}

export const MANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
export const MANEDER_KORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export function kortDato(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}. ${MANEDER_KORT[m - 1]}`
}

export function delerAvDag(dag: number): { ar: number; mnd: number; dag: number } {
  const d = new Date(dag * MS_PER_DAG)
  return { ar: d.getUTCFullYear(), mnd: d.getUTCMonth(), dag: d.getUTCDate() }
}

export function forsteIManed(dag: number): number {
  const { ar, mnd } = delerAvDag(dag)
  return Math.round(Date.UTC(ar, mnd, 1) / MS_PER_DAG)
}

export function nesteManed(dag: number): number {
  const { ar, mnd } = delerAvDag(dag)
  return Math.round(Date.UTC(ar, mnd + 1, 1) / MS_PER_DAG)
}
