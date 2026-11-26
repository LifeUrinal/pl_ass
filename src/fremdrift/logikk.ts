import type { Aktivitet, Fremdriftsplan, GrupperEtter, Visning } from './types'
import { AKTIVITET_TYPER } from './types'
import { antallDager, leggTilDager, tilDag } from './dato'

export function nyId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** En avhengighet er brutt når etterfølgeren starter før (eller samme dag som) forgjengeren slutter. */
export function konflikterFor(a: Aktivitet, alle: Map<string, Aktivitet>): Aktivitet[] {
  return a.avhengerAv
    .map((id) => alle.get(id))
    .filter((f): f is Aktivitet => !!f && tilDag(a.start) <= tilDag(f.slutt))
}

export function finnKonflikter(aktiviteter: Aktivitet[]): Set<string> {
  const map = new Map(aktiviteter.map((a) => [a.id, a]))
  const ut = new Set<string>()
  for (const a of aktiviteter) if (konflikterFor(a, map).length > 0) ut.add(a.id)
  return ut
}

export type Status = 'ferdig' | 'forsinket' | 'konflikt' | 'pagar' | 'ikke-startet'

export function statusFor(a: Aktivitet, konflikt: boolean, idag: string): Status {
  if (a.fremdrift >= 100) return 'ferdig'
  if (a.slutt < idag) return 'forsinket'
  if (konflikt) return 'konflikt'
  if (a.start <= idag) return 'pagar'
  return 'ikke-startet'
}

export const STATUS_TEKST: Record<Status, { tekst: string; klasse: string }> = {
  ferdig: { tekst: 'Ferdig', klasse: 'pill-ok' },
  forsinket: { tekst: 'Forsinket', klasse: 'pill-danger' },
  konflikt: { tekst: 'Avhengighetskonflikt', klasse: 'pill-danger' },
  pagar: { tekst: 'Pågår', klasse: 'pill-ok' },
  'ikke-startet': { tekst: 'Ikke startet', klasse: 'pill-muted' },
}

/** Etterfølgere = aktiviteter som avhenger av denne. */
export function etterfolgere(id: string, aktiviteter: Aktivitet[]): Aktivitet[] {
  return aktiviteter.filter((a) => a.avhengerAv.includes(id))
}

/** Vil det å legge til "fra avhenger av til" skape en sirkel? */
export function lagerSirkel(fra: string, til: string, aktiviteter: Aktivitet[]): boolean {
  if (fra === til) return true
  // til -> ... -> fra via avhengerAv?
  const map = new Map(aktiviteter.map((a) => [a.id, a]))
  const stack = [til]
  const sett = new Set<string>()
  while (stack.length) {
    const id = stack.pop()!
    if (id === fra) return true
    if (sett.has(id)) continue
    sett.add(id)
    stack.push(...(map.get(id)?.avhengerAv ?? []))
  }
  return false
}

/**
 * Skyver alle etterfølgere (rekursivt) slik at de starter dagen etter at forgjengerne er ferdige.
 * Varigheten beholdes. Aktiviteter flyttes kun fremover.
 */
export function skyvEtterfolgere(aktiviteter: Aktivitet[], fraId: string): Aktivitet[] {
  const map = new Map(aktiviteter.map((a) => [a.id, { ...a }]))
  const ko = [fraId]
  let vakt = 0
  while (ko.length && vakt++ < 10_000) {
    const id = ko.shift()!
    const forgjenger = map.get(id)!
    for (const a of map.values()) {
      if (!a.avhengerAv.includes(id)) continue
      const tidligst = tilDag(forgjenger.slutt) + 1
      const diff = tidligst - tilDag(a.start)
      if (diff > 0) {
        a.start = leggTilDager(a.start, diff)
        a.slutt = leggTilDager(a.slutt, diff)
        ko.push(a.id)
      }
    }
  }
  return aktiviteter.map((a) => map.get(a.id)!)
}

/** Flytter én aktivitet til dagen etter at den siste forgjengeren er ferdig. */
export function flyttEtterForgjengere(aktiviteter: Aktivitet[], id: string): Aktivitet[] {
  const map = new Map(aktiviteter.map((a) => [a.id, a]))
  const a = map.get(id)
  if (!a) return aktiviteter
  const sisteSlutt = Math.max(...a.avhengerAv.map((f) => (map.get(f) ? tilDag(map.get(f)!.slutt) : -Infinity)))
  if (!isFinite(sisteSlutt)) return aktiviteter
  const diff = sisteSlutt + 1 - tilDag(a.start)
  if (diff <= 0) return aktiviteter
  return aktiviteter.map((x) =>
    x.id === id ? { ...x, start: leggTilDager(x.start, diff), slutt: leggTilDager(x.slutt, diff) } : x,
  )
}

export function filtrer(aktiviteter: Aktivitet[], visning: Visning, sok: string, konflikter: Set<string>, idag: string) {
  const s = sok.trim().toLowerCase()
  const om14 = leggTilDager(idag, 14)
  return aktiviteter.filter((a) => {
    if (s && !a.navn.toLowerCase().includes(s)) return false
    switch (visning) {
      case 'konflikter':
        return konflikter.has(a.id)
      case 'pagar':
        return a.start <= idag && a.slutt >= idag
      case 'neste14':
        return a.start <= om14 && a.slutt >= idag
      case 'forsinket':
        return a.slutt < idag && a.fremdrift < 100
      default:
        return true
    }
  })
}

export interface Gruppe {
  id: string
  navn: string
  aktiviteter: Aktivitet[]
}

export function grupper(plan: Fremdriftsplan, aktiviteter: Aktivitet[], etter: GrupperEtter): Gruppe[] {
  const sortert = [...aktiviteter].sort((a, b) => a.start.localeCompare(b.start) || a.slutt.localeCompare(b.slutt))
  if (etter === 'ingen') return [{ id: 'alle', navn: 'Alle aktiviteter', aktiviteter: sortert }]

  const kilder: { id: string; navn: string }[] =
    etter === 'omrade' ? plan.omrader : etter === 'firma' ? plan.firmaer : AKTIVITET_TYPER
  const nokkel = (a: Aktivitet) => (etter === 'omrade' ? a.omradeId : etter === 'firma' ? a.firmaId : a.type)

  const ut: Gruppe[] = kilder.map((k) => ({ id: k.id, navn: k.navn, aktiviteter: sortert.filter((a) => nokkel(a) === k.id) }))
  const kjente = new Set(kilder.map((k) => k.id))
  const uten = sortert.filter((a) => !kjente.has(nokkel(a) ?? ''))
  if (uten.length) ut.push({ id: '__uten', navn: etter === 'omrade' ? 'Uten område' : 'Uten firma', aktiviteter: uten })
  return ut.filter((g) => g.aktiviteter.length > 0)
}

/** Vektet fremdrift (etter varighet) for en liste aktiviteter. */
export function samletFremdrift(aktiviteter: Aktivitet[]): number {
  let sum = 0
  let vekt = 0
  for (const a of aktiviteter) {
    const v = antallDager(a.start, a.slutt)
    sum += a.fremdrift * v
    vekt += v
  }
  return vekt ? Math.round(sum / vekt) : 0
}

export function spenn(aktiviteter: Aktivitet[]): { start: string; slutt: string } | null {
  if (!aktiviteter.length) return null
  let start = aktiviteter[0].start
  let slutt = aktiviteter[0].slutt
  for (const a of aktiviteter) {
    if (a.start < start) start = a.start
    if (a.slutt > slutt) slutt = a.slutt
  }
  return { start, slutt }
}

export function initialer(navn: string): string {
  return navn
    .split(/[\s&/-]+/)
    .filter((w) => w && /[A-Za-zÆØÅæøå]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

export const FIRMA_FARGER = ['#2f80ed', '#27ae60', '#eb5757', '#f2994a', '#9b51e0', '#00a3a3', '#c2185b', '#6d7a8a', '#b8860b', '#3f51b5']
export const OMRADE_FARGER = ['#6c8cff', '#38b2ac', '#ed8936', '#9f7aea', '#e53e3e', '#48bb78', '#d69e2e', '#4a5568']
