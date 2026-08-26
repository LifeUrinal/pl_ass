// Domenemodeller for prosjektøkonomi-appen.
// Alle beløp er i NOK (kroner), ikke øre.

export type EndringStatus = 'Godkjent' | 'Avslått' | 'Til behandling' | 'Utkast' | 'Annet'

/** Én rad i faktureringsplanen mot byggherre: planlagt fakturert beløp for en gitt måned. */
export interface FaktureringsplanRad {
  maned: string // YYYY-MM
  planlagtBelop: number
}

/** Én rad i endringsloggen (endringer mot byggherre / EO-liste). */
export interface EndringRad {
  id: string
  tittel: string
  status: EndringStatus
  belop: number
  dato?: string // YYYY-MM-DD, dato for status/opprettelse
  beskrivelse?: string
}

/** Én rad i beslutningsplanen: en avklaring byggherren må ta stilling til innen en dato. */
export interface BeslutningRad {
  id: string
  tema: string
  fristDato: string // YYYY-MM-DD
  ansvarlig?: string
  status?: string
  knyttetProdkode?: string
  henvisning?: string
}

/** Én rad i innkjøpsplanen: når en entreprise/fag skal kjøpes inn. */
export interface InnkjopRad {
  id: string
  entreprise: string
  prodkode?: string
  planlagtUtsendelseDato?: string // YYYY-MM-DD - når underlag skal ut
  planlagtInnkjopsdato: string // YYYY-MM-DD - når kontrakt skal signeres
  budsjett?: number
  status?: string
}

/** Én rad fra utskrift av "Prosjektinfo": budsjett/prognose/sluttkost per prodkode. */
export interface ProsjektinfoRad {
  prodkode: string
  betegnelse: string
  opprinneligBudsjett: number
  revidertBudsjett: number
  produsertVerdi: number // opptjent/produsert verdi hittil (fra prosjektsystemet)
  paalopteKostnader: number // faktisk kost hittil
  sluttkostPrognose: number // forventet sluttkost
}

/** Én rad fra utskrift av alle fakturaer i prosjektet. */
export interface FakturaRad {
  fakturanr: string
  leverandor: string
  prodkode?: string
  belop: number
  dato: string // YYYY-MM-DD
  tekst?: string
}

export interface RawUploadedFile {
  name: string
  sizeBytes: number
  uploadedAt: string
  sheetNames: string[]
}

export type RequiredFileKey =
  | 'fakturaer'
  | 'endringslogg'
  | 'prosjektinfo'
  | 'faktureringsplan'
  | 'beslutningsplan'
  | 'innkjopsplan'

export interface FileDefinition {
  key: RequiredFileKey
  label: string
  description: string
}

export const REQUIRED_FILES: FileDefinition[] = [
  {
    key: 'fakturaer',
    label: 'Utskrift av alle fakturaer',
    description: 'Alle fakturaer i prosjektet, med leverandør, prodkode, beløp og dato.',
  },
  {
    key: 'endringslogg',
    label: 'Endringslogg',
    description: 'Tilpasset endringslogg for prosjektet (endringer mot byggherre), med status og beløp.',
  },
  {
    key: 'prosjektinfo',
    label: 'Utskrift fra "Prosjektinfo"',
    description: 'Budsjett, produsert verdi, påløpt og sluttkostprognose per prodkode.',
  },
  {
    key: 'faktureringsplan',
    label: 'Faktureringsplan mot byggherre',
    description: 'Planlagt fakturering per måned. Danner start-/sluttdato og inntektsgrunnlag.',
  },
  {
    key: 'beslutningsplan',
    label: 'Beslutningsplan',
    description: 'Avklaringer som må besluttes av byggherren, med frist.',
  },
  {
    key: 'innkjopsplan',
    label: 'Innkjøpsplan',
    description: 'Når de ulike entreprisene skal kjøpes inn.',
  },
]

export interface ProjectDataSet {
  faktureringsplan: FaktureringsplanRad[]
  endringslogg: EndringRad[]
  beslutningsplan: BeslutningRad[]
  innkjopsplan: InnkjopRad[]
  prosjektinfo: ProsjektinfoRad[]
  fakturaer: FakturaRad[]
  meta: Partial<Record<RequiredFileKey, RawUploadedFile>>
  braI?: number // bruksareal internt (m2), brukes til kvadratmeterpris
  projectName?: string
}
