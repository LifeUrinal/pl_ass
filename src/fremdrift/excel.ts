import * as XLSX from 'xlsx'
import type { Aktivitet, AktivitetType, Fremdriftsplan } from './types'
import { AKTIVITET_TYPER } from './types'
import { antallDager, arbeidsdager, fraDag } from './dato'
import { FIRMA_FARGER, nyId } from './logikk'

const KOLONNER = ['Nr', 'Område', 'Firma', 'Type', 'Aktivitet', 'Start', 'Slutt', 'Dager', 'Arbeidsdager', 'Fremdrift %', 'Avhenger av (Nr)', 'Notat']

/** Eksporterer planen til et regneark. Samme format kan leses inn igjen. */
export function eksporterExcel(plan: Fremdriftsplan) {
  const nr = new Map(plan.aktiviteter.map((a, i) => [a.id, i + 1]))
  const rader = plan.aktiviteter.map((a) => [
    nr.get(a.id),
    plan.omrader.find((o) => o.id === a.omradeId)?.navn ?? '',
    plan.firmaer.find((f) => f.id === a.firmaId)?.navn ?? '',
    AKTIVITET_TYPER.find((t) => t.id === a.type)?.navn ?? a.type,
    a.navn,
    a.start,
    a.slutt,
    antallDager(a.start, a.slutt),
    arbeidsdager(a.start, a.slutt),
    a.fremdrift,
    a.avhengerAv.map((id) => nr.get(id)).filter(Boolean).join(', '),
    a.notat ?? '',
  ])
  const ws = XLSX.utils.aoa_to_sheet([KOLONNER, ...rader])
  ws['!cols'] = [6, 22, 20, 14, 36, 12, 12, 7, 12, 11, 16, 30].map((wch) => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fremdriftsplan')
  XLSX.writeFile(wb, `Fremdriftsplan - ${(plan.prosjektnavn || 'prosjekt').replace(/[\\/:*?"<>|]/g, '')}.xlsx`)
}

function tilIso(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    // SheetJS gir lokal midnatt; bruk lokale datodeler
    return fraDag(Math.round(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) / 86_400_000))
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel-serienummer
    return fraDag(Math.round(v - 25569))
  }
  if (typeof v === 'string') {
    const s = v.trim()
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/)
    if (m) {
      const ar = m[3].length === 2 ? '20' + m[3] : m[3]
      return `${ar}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }
  }
  return null
}

function normaliser(s: string) {
  return s.toLowerCase().replace(/[^a-zæøå0-9]/g, '')
}

/** Finn kolonne ut fra en liste mulige overskrifter. */
function finnKolonne(overskrifter: string[], ...kandidater: string[]): number {
  const n = overskrifter.map((o) => normaliser(String(o ?? '')))
  for (const k of kandidater) {
    const i = n.findIndex((o) => o === normaliser(k))
    if (i >= 0) return i
  }
  for (const k of kandidater) {
    const i = n.findIndex((o) => o.startsWith(normaliser(k)))
    if (i >= 0) return i
  }
  return -1
}

function tilType(v: unknown): AktivitetType {
  const s = normaliser(String(v ?? ''))
  if (s.startsWith('prosj')) return 'prosjektering'
  if (s.startsWith('test') || s.startsWith('idrift') || s.startsWith('funksjon')) return 'testing'
  if (s.startsWith('befar')) return 'befaring'
  if (s.startsWith('overlev')) return 'overlevering'
  return 'utforelse'
}

/**
 * Leser inn en aktivitetsliste fra Excel/CSV. Kolonnene gjenkjennes på navn
 * (samme som i eksporten, men også vanlige varianter som «Fra», «Til», «UE»).
 */
export async function importerExcel(fil: File, prosjektnavn: string): Promise<{ plan: Fremdriftsplan; advarsler: string[] }> {
  const wb = XLSX.read(await fil.arrayBuffer(), { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const matrise = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })

  // overskriftsraden = første rad blant de ti første som har både en aktivitets- og en startkolonne
  let hodeIdx = -1
  for (let i = 0; i < Math.min(10, matrise.length); i++) {
    const h = matrise[i].map(String)
    if (finnKolonne(h, 'Aktivitet', 'Oppgave', 'Beskrivelse', 'Navn') >= 0 && finnKolonne(h, 'Start', 'Fra', 'Startdato') >= 0) {
      hodeIdx = i
      break
    }
  }
  if (hodeIdx < 0) throw new Error('Fant ikke kolonnene «Aktivitet» og «Start» i de ti første radene.')

  const h = matrise[hodeIdx].map(String)
  const k = {
    nr: finnKolonne(h, 'Nr', 'ID', 'Løpenr'),
    omrade: finnKolonne(h, 'Område', 'Sone', 'Lokasjon', 'Bygg'),
    firma: finnKolonne(h, 'Firma', 'UE', 'Underentreprenør', 'Entreprenør', 'Ansvarlig'),
    type: finnKolonne(h, 'Type', 'Fase', 'Kategori'),
    navn: finnKolonne(h, 'Aktivitet', 'Oppgave', 'Beskrivelse', 'Navn'),
    start: finnKolonne(h, 'Start', 'Fra', 'Startdato'),
    slutt: finnKolonne(h, 'Slutt', 'Til', 'Sluttdato', 'Ferdig'),
    dager: finnKolonne(h, 'Dager', 'Varighet'),
    fremdrift: finnKolonne(h, 'Fremdrift', 'Ferdigstilt', 'Progress'),
    avh: finnKolonne(h, 'Avhenger av', 'Avhengighet', 'Forgjenger'),
    notat: finnKolonne(h, 'Notat', 'Kommentar', 'Merknad'),
  }

  const plan: Fremdriftsplan = { prosjektnavn, omrader: [], firmaer: [], aktiviteter: [] }
  const advarsler: string[] = []
  const nrTilId = new Map<string, string>()
  const navnTilId = new Map<string, string>()
  const avhRa: [string, string][] = []
  const celle = (rad: unknown[], i: number) => (i >= 0 ? rad[i] : '')

  matrise.slice(hodeIdx + 1).forEach((rad, i) => {
    const navn = String(celle(rad, k.navn) ?? '').trim()
    if (!navn) return
    const start = tilIso(celle(rad, k.start))
    let slutt = tilIso(celle(rad, k.slutt))
    if (!start) {
      advarsler.push(`Rad ${hodeIdx + i + 2}: «${navn}» mangler gyldig startdato og ble hoppet over.`)
      return
    }
    if (!slutt) {
      const d = Number(celle(rad, k.dager))
      slutt = d > 0 ? fraDag(Math.round(Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10)) / 86_400_000) + d - 1) : start
    }
    if (slutt < start) slutt = start

    const omradeNavn = String(celle(rad, k.omrade) ?? '').trim()
    let omradeId: string | null = null
    if (omradeNavn) {
      omradeId = plan.omrader.find((o) => o.navn === omradeNavn)?.id ?? null
      if (!omradeId) {
        omradeId = nyId()
        plan.omrader.push({ id: omradeId, navn: omradeNavn })
      }
    }
    const firmaNavn = String(celle(rad, k.firma) ?? '').trim()
    let firmaId: string | null = null
    if (firmaNavn) {
      firmaId = plan.firmaer.find((f) => f.navn === firmaNavn)?.id ?? null
      if (!firmaId) {
        firmaId = nyId()
        plan.firmaer.push({ id: firmaId, navn: firmaNavn, farge: FIRMA_FARGER[plan.firmaer.length % FIRMA_FARGER.length] })
      }
    }

    let fremdrift = Number(String(celle(rad, k.fremdrift) ?? '').replace('%', '').replace(',', '.')) || 0
    if (fremdrift > 0 && fremdrift <= 1 && !String(celle(rad, k.fremdrift)).includes('%')) fremdrift *= 100
    const akt: Aktivitet = {
      id: nyId(),
      navn,
      omradeId,
      firmaId,
      type: tilType(celle(rad, k.type)),
      start,
      slutt,
      fremdrift: Math.max(0, Math.min(100, Math.round(fremdrift))),
      avhengerAv: [],
      notat: String(celle(rad, k.notat) ?? '').trim() || undefined,
    }
    plan.aktiviteter.push(akt)
    const nr = String(celle(rad, k.nr) ?? '').trim()
    if (nr) nrTilId.set(nr, akt.id)
    navnTilId.set(navn.toLowerCase(), akt.id)
    const avh = String(celle(rad, k.avh) ?? '').trim()
    if (avh) avhRa.push([akt.id, avh])
  })

  // avhengigheter kan oppgis som nr («3, 7») eller navn («Taktekking; Gips plan 1»)
  for (const [id, tekst] of avhRa) {
    const akt = plan.aktiviteter.find((a) => a.id === id)!
    for (const del of tekst.split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
      const fId = nrTilId.get(del) ?? navnTilId.get(del.toLowerCase())
      if (fId && fId !== id) akt.avhengerAv.push(fId)
      else advarsler.push(`«${akt.navn}»: fant ikke avhengigheten «${del}».`)
    }
  }

  if (!plan.aktiviteter.length) throw new Error('Fant ingen aktiviteter med gyldig startdato.')
  return { plan, advarsler }
}
