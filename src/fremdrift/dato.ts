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

export function arbeidsdager(start: string, slutt: string): number {
  let n = 0
  for (let d = tilDag(start); d <= tilDag(slutt); d++) if (!erHelg(d)) n++
  return n
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
