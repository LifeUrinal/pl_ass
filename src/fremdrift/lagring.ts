import { get, set } from 'idb-keyval'
import type { Aktivitet, AktivitetType, Fremdriftsplan } from './types'
import { fraDag, iDag, tilDag, ukedag } from './dato'

const KEY = 'fremdrift:plan:v1'

export async function lastPlan(): Promise<Fremdriftsplan | undefined> {
  const p: Fremdriftsplan | undefined = await get(KEY)
  return p && normaliserPlan(p)
}

/** Fyller inn felter som mangler i planer lagret med en eldre versjon av appen. */
export function normaliserPlan(p: Fremdriftsplan): Fremdriftsplan {
  return {
    ...p,
    bygg: p.bygg ?? [],
    omrader: p.omrader.map((o) => ({ ...o, byggId: o.byggId ?? null })),
  }
}

export async function lagrePlan(plan: Fremdriftsplan): Promise<void> {
  await set(KEY, plan)
}

export const TOM_PLAN: Fremdriftsplan = { prosjektnavn: 'Nytt prosjekt', bygg: [], omrader: [], firmaer: [], aktiviteter: [] }

/** Eksempelplan, lagt rundt dagens dato slik at noe er ferdig, noe pågår og noe kommer. */
export function eksempelplan(): Fremdriftsplan {
  const idag = tilDag(iDag())
  const mandag = idag - ukedag(idag) - 28 // fire uker tilbake

  const bygg = [
    { id: 'b1', navn: 'Bygg A – Kontor' },
    { id: 'b2', navn: 'Bygg B – Parkering' },
    { id: 'b3', navn: 'Utomhus' },
  ]
  const omrader = [
    { id: 'o1', navn: 'Plan 1', byggId: 'b1' },
    { id: 'o2', navn: 'Plan 2', byggId: 'b1' },
    { id: 'o3', navn: 'Teknisk rom', byggId: 'b1' },
    { id: 'o4', navn: 'Tak', byggId: 'b1' },
    { id: 'o6', navn: 'Parkeringskjeller', byggId: 'b2' },
    { id: 'o7', navn: 'Rampe og port', byggId: 'b2' },
    { id: 'o5', navn: 'Uteområde', byggId: 'b3' },
  ]
  const firmaer = [
    { id: 'f1', navn: 'Elektro AS', farge: '#2f80ed' },
    { id: 'f2', navn: 'Rør & Varme AS', farge: '#27ae60' },
    { id: 'f3', navn: 'Ventilasjon Nord', farge: '#eb5757' },
    { id: 'f4', navn: 'Tømrer Hansen', farge: '#f2994a' },
    { id: 'f5', navn: 'Maler Berg', farge: '#9b51e0' },
    { id: 'f6', navn: 'Byggherre', farge: '#6d7a8a' },
  ]

  let n = 0
  const akt: Aktivitet[] = []
  const a = (
    navn: string,
    omradeId: string,
    firmaId: string,
    type: AktivitetType,
    fraUkedag: number,
    varighet: number,
    fremdrift: number,
    avhengerAv: string[] = [],
  ): string => {
    const id = `a${++n}`
    akt.push({
      id,
      navn,
      omradeId,
      firmaId,
      type,
      start: fraDag(mandag + fraUkedag),
      slutt: fraDag(mandag + fraUkedag + varighet - 1),
      fremdrift,
      avhengerAv,
    })
    return id
  }

  // Teknisk rom
  const pVvs = a('Prosjektering VVS', 'o3', 'f2', 'prosjektering', 0, 12, 100)
  const pVent = a('Prosjektering ventilasjon', 'o3', 'f3', 'prosjektering', 0, 12, 100)
  const pEl = a('Prosjektering elektro', 'o3', 'f1', 'prosjektering', 2, 14, 100)
  const aggregat = a('Montasje ventilasjonsaggregat', 'o3', 'f3', 'utforelse', 14, 20, 60, [pVent])
  const sentral = a('Varmesentral og rørføring', 'o3', 'f2', 'utforelse', 14, 19, 65, [pVvs])
  const tavle = a('Hovedtavle og føringsveier', 'o3', 'f1', 'utforelse', 17, 18, 50, [pEl])
  const innreg = a('Innregulering ventilasjon', 'o3', 'f3', 'testing', 35, 5, 0, [aggregat])
  const trykk = a('Trykktest rør', 'o3', 'f2', 'testing', 33, 3, 0, [sentral])

  // Plan 1
  const vegg1 = a('Innervegger plan 1', 'o1', 'f4', 'utforelse', 7, 15, 90)
  const el1 = a('Elektro – rør i vegg plan 1', 'o1', 'f1', 'utforelse', 16, 10, 100, [pEl])
  const rør1 = a('Sanitær plan 1', 'o1', 'f2', 'utforelse', 17, 14, 70, [pVvs])
  const kledning1 = a('Gips og sparkel plan 1', 'o1', 'f4', 'utforelse', 31, 8, 0, [vegg1, el1, rør1])
  const maling1 = a('Maling plan 1', 'o1', 'f5', 'utforelse', 39, 8, 0, [kledning1])
  const bef1 = a('Forbefaring plan 1', 'o1', 'f6', 'befaring', 47, 1, 0, [maling1])

  // Plan 2
  const vegg2 = a('Innervegger plan 2', 'o2', 'f4', 'utforelse', 21, 15, 25)
  const el2 = a('Elektro – rør i vegg plan 2', 'o2', 'f1', 'utforelse', 28, 10, 0, [vegg2]) // konflikt
  const kledning2 = a('Gips og sparkel plan 2', 'o2', 'f4', 'utforelse', 42, 8, 0, [vegg2, el2])
  const maling2 = a('Maling plan 2', 'o2', 'f5', 'utforelse', 52, 8, 0, [kledning2])
  const bef2 = a('Forbefaring plan 2', 'o2', 'f6', 'befaring', 61, 1, 0, [maling2])

  // Tak
  const tekking = a('Taktekking', 'o4', 'f4', 'utforelse', 0, 18, 100)
  a('Taksluk og nedløp', 'o4', 'f2', 'utforelse', 18, 6, 100, [tekking])
  a('Befaring tak', 'o4', 'f6', 'befaring', 24, 1, 0, [tekking])

  // Bygg B – parkering
  const pPark = a('Prosjektering ventilasjon P-kjeller', 'o6', 'f3', 'prosjektering', 7, 10, 100)
  const ventP = a('CO-avtrekk og vifter', 'o6', 'f3', 'utforelse', 21, 15, 30, [pPark])
  const lysP = a('Belysning P-kjeller', 'o6', 'f1', 'utforelse', 24, 12, 20, [pEl])
  a('Merking og maling gulv', 'o6', 'f5', 'utforelse', 42, 5, 0, [ventP, lysP])
  const port = a('Montasje garasjeport', 'o7', 'f4', 'utforelse', 28, 6, 0)
  const portTest = a('Test portautomatikk', 'o7', 'f1', 'testing', 35, 2, 0, [port])
  a('Befaring parkering', 'o6', 'f6', 'befaring', 50, 1, 0, [portTest, ventP])

  // Utomhus
  a('Utvendig belysning', 'o5', 'f1', 'utforelse', 49, 8, 0, [tavle])
  const ferdig = a('Funksjonstest tekniske anlegg', 'o3', 'f6', 'testing', 54, 5, 0, [innreg, trykk, tavle])
  a('Overlevering til byggherre', 'o1', 'f6', 'overlevering', 64, 1, 0, [bef1, bef2, ferdig])

  return { prosjektnavn: 'Kontorbygg Sentrum', bygg, omrader, firmaer, aktiviteter: akt }
}
