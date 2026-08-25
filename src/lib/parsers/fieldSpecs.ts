import type { FieldSpec } from './mapping'
import type { RequiredFileKey } from '../../types'

export const FIELD_SPECS: Record<RequiredFileKey, FieldSpec[]> = {
  fakturaer: [
    { key: 'fakturanr', label: 'Fakturanr', synonyms: ['fakturanr', 'fakturanummer', 'faktura nr', 'bilagsnr', 'bilag'], required: false, type: 'string' },
    { key: 'leverandor', label: 'Leverandør', synonyms: ['leverandør', 'leverandor', 'kreditor', 'firma', 'avsender'], required: true, type: 'string' },
    { key: 'prodkode', label: 'Prodkode', synonyms: ['prodkode', 'produksjonskode', 'kode', 'kalkylenr', 'kontonr'], required: false, type: 'string' },
    { key: 'belop', label: 'Beløp', synonyms: ['beløp', 'belop', 'sum', 'fakturabeløp', 'nettobeløp', 'beløp eks mva', 'beløp ekskl mva'], required: true, type: 'number' },
    { key: 'dato', label: 'Dato', synonyms: ['dato', 'fakturadato', 'bilagsdato', 'bokføringsdato'], required: true, type: 'date' },
    { key: 'tekst', label: 'Tekst / beskrivelse', synonyms: ['tekst', 'beskrivelse', 'kommentar', 'merknad'], required: false, type: 'string' },
  ],
  endringslogg: [
    { key: 'id', label: 'Nr', synonyms: ['nr', 'endringsnr', 'eo nr', 'id', 'løpenr'], required: false, type: 'string' },
    { key: 'tittel', label: 'Tittel', synonyms: ['tittel', 'emne', 'beskrivelse', 'endring', 'sak'], required: true, type: 'string' },
    { key: 'status', label: 'Status', synonyms: ['status', 'godkjenningsstatus'], required: true, type: 'string' },
    { key: 'belop', label: 'Beløp', synonyms: ['beløp', 'belop', 'sum', 'verdi', 'endringsbeløp'], required: true, type: 'number' },
    { key: 'dato', label: 'Dato', synonyms: ['dato', 'registrert', 'opprettet', 'behandlet dato', 'godkjent dato'], required: false, type: 'date' },
    { key: 'beskrivelse', label: 'Beskrivelse', synonyms: ['beskrivelse', 'kommentar', 'merknad'], required: false, type: 'string' },
  ],
  prosjektinfo: [
    { key: 'prodkode', label: 'Prodkode', synonyms: ['prodkode', 'produksjonskode', 'kode', 'kalkylenr', 'kontonr'], required: true, type: 'string' },
    { key: 'betegnelse', label: 'Betegnelse', synonyms: ['betegnelse', 'beskrivelse', 'tekst', 'navn', 'fag'], required: false, type: 'string' },
    { key: 'opprinneligBudsjett', label: 'Opprinnelig budsjett', synonyms: ['opprinnelig budsjett', 'kalkyle', 'opprinnelig kalkyle', 'basisbudsjett', 'kontrakt'], required: true, type: 'number' },
    { key: 'revidertBudsjett', label: 'Revidert budsjett', synonyms: ['revidert budsjett', 'gjeldende budsjett', 'budsjett'], required: false, type: 'number' },
    { key: 'produsertVerdi', label: 'Produsert verdi', synonyms: ['produsert verdi', 'opptjent verdi', 'opptjent', 'produksjon'], required: false, type: 'number' },
    { key: 'paalopteKostnader', label: 'Påløpte kostnader', synonyms: ['påløpt', 'paalopt', 'kost hittil', 'faktisk kost', 'regnskap'], required: false, type: 'number' },
    { key: 'sluttkostPrognose', label: 'Sluttkostprognose', synonyms: ['sluttkost', 'prognose', 'forventet sluttkost', 'estimert sluttkost'], required: true, type: 'number' },
  ],
  faktureringsplan: [
    { key: 'maned', label: 'Måned', synonyms: ['måned', 'maned', 'periode', 'dato'], required: true, type: 'date' },
    { key: 'planlagtBelop', label: 'Planlagt fakturabeløp', synonyms: ['planlagt fakturering', 'planlagt beløp', 'fakturaplan', 'beløp', 'sum'], required: true, type: 'number' },
  ],
  beslutningsplan: [
    { key: 'id', label: 'Nr', synonyms: ['nr', 'id', 'løpenr'], required: false, type: 'string' },
    { key: 'tema', label: 'Tema / avklaring', synonyms: ['tema', 'avklaring', 'beskrivelse', 'sak', 'beslutning'], required: true, type: 'string' },
    { key: 'fristDato', label: 'Frist for beslutning', synonyms: ['frist', 'beslutningsdato', 'dato', 'behov innen', 'behovsdato'], required: true, type: 'date' },
    { key: 'ansvarlig', label: 'Ansvarlig', synonyms: ['ansvarlig', 'byggherre', 'beslutningstaker'], required: false, type: 'string' },
    { key: 'status', label: 'Status', synonyms: ['status'], required: false, type: 'string' },
    { key: 'knyttetProdkode', label: 'Prodkode', synonyms: ['prodkode', 'kode', 'fag'], required: false, type: 'string' },
  ],
  innkjopsplan: [
    { key: 'id', label: 'Nr', synonyms: ['nr', 'id', 'løpenr'], required: false, type: 'string' },
    { key: 'entreprise', label: 'Entreprise / fag', synonyms: ['entreprise', 'fag', 'kontrakt', 'beskrivelse', 'tittel'], required: true, type: 'string' },
    { key: 'prodkode', label: 'Prodkode', synonyms: ['prodkode', 'kode'], required: false, type: 'string' },
    { key: 'planlagtUtsendelseDato', label: 'Planlagt utsendelse', synonyms: ['utsendelse', 'utsendt', 'forespørsel'], required: false, type: 'date' },
    { key: 'planlagtInnkjopsdato', label: 'Planlagt innkjøpsdato', synonyms: ['innkjøpsdato', 'innkjop', 'kontraktsignering', 'planlagt innkjøp', 'dato'], required: true, type: 'date' },
    { key: 'budsjett', label: 'Budsjett', synonyms: ['budsjett', 'beløp', 'ramme'], required: false, type: 'number' },
    { key: 'status', label: 'Status', synonyms: ['status'], required: false, type: 'string' },
  ],
}
