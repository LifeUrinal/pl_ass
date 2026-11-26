// Datamodell for fremdriftsplanen (Gantt).
// Datoer lagres som ISO-strenger 'YYYY-MM-DD' (sluttdato er inklusiv).

export type AktivitetType = 'prosjektering' | 'utforelse' | 'testing' | 'befaring' | 'overlevering'

export const AKTIVITET_TYPER: { id: AktivitetType; navn: string; farge: string }[] = [
  { id: 'prosjektering', navn: 'Prosjektering', farge: '#5b7cfa' },
  { id: 'utforelse', navn: 'Utførelse', farge: '#2f9e8f' },
  { id: 'testing', navn: 'Testing', farge: '#9b5de5' },
  { id: 'befaring', navn: 'Befaring', farge: '#e08a2e' },
  { id: 'overlevering', navn: 'Overlevering', farge: '#d6457a' },
]

export interface Bygg {
  id: string
  navn: string
}

export interface Omrade {
  id: string
  navn: string
  byggId: string | null
}

export interface Firma {
  id: string
  navn: string
  farge: string
}

export interface Aktivitet {
  id: string
  navn: string
  omradeId: string | null
  firmaId: string | null
  type: AktivitetType
  start: string
  slutt: string
  fremdrift: number // 0–100
  avhengerAv: string[] // id-er til aktiviteter som må være ferdige før denne kan starte
  notat?: string
}

export interface Fremdriftsplan {
  prosjektnavn: string
  bygg: Bygg[]
  omrader: Omrade[]
  firmaer: Firma[]
  aktiviteter: Aktivitet[]
}

export type GrupperEtter = 'bygg-omrade' | 'bygg' | 'omrade' | 'firma' | 'type' | 'ingen'
export type FargeEtter = 'type' | 'firma' | 'omrade' | 'bygg'
export type Zoom = 'dag' | 'uke' | 'maned'
export type Visning = 'alle' | 'konflikter' | 'pagar' | 'neste14' | 'forsinket'
