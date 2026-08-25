import type {
  BeslutningRad,
  EndringRad,
  EndringStatus,
  FakturaRad,
  FaktureringsplanRad,
  InnkjopRad,
  ProjectDataSet,
  ProsjektinfoRad,
} from '../types'

export function monthDiff(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split('-').map(Number)
  const [ty, tm] = toIso.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

export function addMonths(iso: string, n: number): string {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function todayIsoMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface FaktureringsplanSummary {
  startManed: string | null
  sluttManed: string | null
  varighetMåneder: number
  totalPlanlagt: number
  rader: FaktureringsplanRad[]
}

export function summarizeFaktureringsplan(rader: FaktureringsplanRad[]): FaktureringsplanSummary {
  const sorted = [...rader].sort((a, b) => a.maned.localeCompare(b.maned))
  const startManed = sorted[0]?.maned ?? null
  const sluttManed = sorted[sorted.length - 1]?.maned ?? null
  const varighetMåneder = startManed && sluttManed ? monthDiff(startManed, sluttManed) + 1 : 0
  const totalPlanlagt = sorted.reduce((s, r) => s + r.planlagtBelop, 0)
  return { startManed, sluttManed, varighetMåneder, totalPlanlagt, rader: sorted }
}

export interface BudgetSummary {
  opprinneligBudsjett: number
  godkjenteEndringerSum: number
  budsjettPlussGodkjenteEndringer: number
  sluttkost: number
  dekningsgrad: number // andel, f.eks 0.08 = 8 %
  avvikSluttkostMotBudsjett: number
}

export function summarizeBudget(prosjektinfo: ProsjektinfoRad[], endringslogg: EndringRad[]): BudgetSummary {
  const opprinneligBudsjett = prosjektinfo.reduce((s, r) => s + r.opprinneligBudsjett, 0)
  const godkjenteEndringerSum = endringslogg
    .filter((e) => e.status === 'Godkjent')
    .reduce((s, e) => s + e.belop, 0)
  const budsjettPlussGodkjenteEndringer = opprinneligBudsjett + godkjenteEndringerSum
  const sluttkost = prosjektinfo.reduce((s, r) => s + r.sluttkostPrognose, 0)
  const dekningsgrad = budsjettPlussGodkjenteEndringer !== 0
    ? (budsjettPlussGodkjenteEndringer - sluttkost) / budsjettPlussGodkjenteEndringer
    : 0
  return {
    opprinneligBudsjett,
    godkjenteEndringerSum,
    budsjettPlussGodkjenteEndringer,
    sluttkost,
    dekningsgrad,
    avvikSluttkostMotBudsjett: sluttkost - budsjettPlussGodkjenteEndringer,
  }
}

export interface SCurvePoint {
  maned: string
  planlagtKumulativt: number
  fakturertKumulativt: number | null // null etter siste faktiske faktura
}

export interface SCurveData {
  punkter: SCurvePoint[]
  produsertVerdiHittil: number
  fakturertHittilSum: number
}

export function buildSCurve(
  faktureringsplan: FaktureringsplanRad[],
  fakturaer: FakturaRad[],
  prosjektinfo: ProsjektinfoRad[],
): SCurveData {
  const sorted = [...faktureringsplan].sort((a, b) => a.maned.localeCompare(b.maned))
  const fakturertPerManed = new Map<string, number>()
  for (const f of fakturaer) {
    if (!f.dato) continue
    const maned = f.dato.slice(0, 7)
    fakturertPerManed.set(maned, (fakturertPerManed.get(maned) ?? 0) + f.belop)
  }

  const alleManeder = new Set<string>(sorted.map((r) => r.maned))
  for (const m of fakturertPerManed.keys()) alleManeder.add(m)
  const manedListe = [...alleManeder].sort()

  let planKum = 0
  let fakturertKum = 0
  const siste = manedListe[manedListe.length - 1]
  const idagManed = todayIsoMonth()

  const punkter: SCurvePoint[] = manedListe.map((maned) => {
    const plan = sorted.find((r) => r.maned === maned)?.planlagtBelop ?? 0
    planKum += plan
    const harFaktura = fakturertPerManed.has(maned)
    if (harFaktura) fakturertKum += fakturertPerManed.get(maned) ?? 0
    const erFramtid = maned > idagManed && maned !== siste
    return {
      maned,
      planlagtKumulativt: planKum,
      fakturertKumulativt: erFramtid && !harFaktura ? null : fakturertKum,
    }
  })

  const produsertVerdiHittil = prosjektinfo.reduce((s, r) => s + r.produsertVerdi, 0)
  const fakturertHittilSum = fakturaer.reduce((s, f) => s + f.belop, 0)

  return { punkter, produsertVerdiHittil, fakturertHittilSum }
}

export type ProdkodeFlagType = 'PROGNOSE_OVER_BUDSJETT' | 'FORBRUKSTAKT_OVER_BUDSJETT'

export interface ProdkodeFlag {
  type: ProdkodeFlagType
  melding: string
}

export interface ProdkodeAnalyse {
  prodkode: string
  betegnelse: string
  budsjett: number
  paalopt: number
  sluttkostPrognose: number
  paaloptAndel: number // andel av budsjett brukt hittil
  forventetAndelBasertPaTid: number | null // E/D hvis vi har varighet
  projisertSluttkostBasertPaTakt: number | null
  flagg: ProdkodeFlag[]
}

/**
 * Analyserer hver prodkode opp mot budsjett, faktisk påløpt kost, og
 * prosjektets samlede tidsplan (fra faktureringsplanen), for å varsle om
 * mulig kostnadsoverskridelse - jf. eksempelet med stillas (prodkode 139).
 */
export function analyzeProdkoder(
  prosjektinfo: ProsjektinfoRad[],
  faktureringsplanSummary: FaktureringsplanSummary,
): ProdkodeAnalyse[] {
  const { startManed, varighetMåneder } = faktureringsplanSummary
  const idag = todayIsoMonth()
  const elapsed = startManed ? Math.min(Math.max(monthDiff(startManed, idag) + 1, 0), varighetMåneder || Infinity) : null

  return prosjektinfo.map((r) => {
    const budsjett = r.revidertBudsjett || r.opprinneligBudsjett
    const paaloptAndel = budsjett !== 0 ? r.paalopteKostnader / budsjett : 0
    const forventetAndelBasertPaTid = varighetMåneder > 0 && elapsed !== null ? elapsed / varighetMåneder : null
    const projisertSluttkostBasertPaTakt =
      elapsed && elapsed > 0 && varighetMåneder > 0 ? (r.paalopteKostnader / elapsed) * varighetMåneder : null

    const flagg: ProdkodeFlag[] = []
    if (budsjett > 0 && r.sluttkostPrognose > budsjett * 1.02) {
      flagg.push({
        type: 'PROGNOSE_OVER_BUDSJETT',
        melding: `Sluttkostprognose (${formatKr(r.sluttkostPrognose)}) overstiger budsjett (${formatKr(budsjett)}).`,
      })
    }
    if (
      projisertSluttkostBasertPaTakt !== null &&
      budsjett > 0 &&
      projisertSluttkostBasertPaTakt > budsjett * 1.05 &&
      elapsed !== null &&
      elapsed < varighetMåneder
    ) {
      const gjenstaendeBudsjett = budsjett - r.paalopteKostnader
      const gjenstaendeManeder = Math.max(varighetMåneder - elapsed, 1)
      flagg.push({
        type: 'FORBRUKSTAKT_OVER_BUDSJETT',
        melding: `Etter ${elapsed} av ${varighetMåneder} mnd er ${formatKr(r.paalopteKostnader)} påløpt. Ved samme forbrukstakt ender sluttkost på ca. ${formatKr(
          projisertSluttkostBasertPaTakt,
        )} – kun ${formatKr(gjenstaendeBudsjett)} igjen til de siste ${gjenstaendeManeder} mnd.`,
      })
    }

    return {
      prodkode: r.prodkode,
      betegnelse: r.betegnelse,
      budsjett,
      paalopt: r.paalopteKostnader,
      sluttkostPrognose: r.sluttkostPrognose,
      paaloptAndel,
      forventetAndelBasertPaTid,
      projisertSluttkostBasertPaTakt,
      flagg,
    }
  })
}

export interface EndringOversikt {
  totalAntall: number
  totalSum: number
  perStatus: { status: EndringStatus; antall: number; sum: number }[]
}

export function summarizeEndringer(endringslogg: EndringRad[]): EndringOversikt {
  const statuses: EndringStatus[] = ['Godkjent', 'Til behandling', 'Avslått', 'Utkast', 'Annet']
  const perStatus = statuses.map((status) => {
    const rader = endringslogg.filter((e) => e.status === status)
    return { status, antall: rader.length, sum: rader.reduce((s, e) => s + e.belop, 0) }
  }).filter((s) => s.antall > 0)
  return {
    totalAntall: endringslogg.length,
    totalSum: endringslogg.reduce((s, e) => s + e.belop, 0),
    perStatus,
  }
}

export interface LeverandorSum {
  leverandor: string
  sum: number
  antallFakturaer: number
  andelAvTotal: number
}

export function topLeverandorer(fakturaer: FakturaRad[], antall = 10): LeverandorSum[] {
  const map = new Map<string, { sum: number; antall: number }>()
  for (const f of fakturaer) {
    const cur = map.get(f.leverandor) ?? { sum: 0, antall: 0 }
    cur.sum += f.belop
    cur.antall += 1
    map.set(f.leverandor, cur)
  }
  const total = fakturaer.reduce((s, f) => s + f.belop, 0)
  return [...map.entries()]
    .map(([leverandor, v]) => ({ leverandor, sum: v.sum, antallFakturaer: v.antall, andelAvTotal: total !== 0 ? v.sum / total : 0 }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, antall)
}

export interface InnkjopBeslutningKonflikt {
  innkjop: InnkjopRad
  beslutning: BeslutningRad
  melding: string
}

/**
 * Sjekker om et innkjøp er planlagt før den tilhørende avklaringen (samme
 * prodkode) i beslutningsplanen har frist - dvs. risiko for å kjøpe inn før
 * grunnlaget er avklart.
 */
export function findInnkjopBeslutningKonflikter(
  innkjopsplan: InnkjopRad[],
  beslutningsplan: BeslutningRad[],
): InnkjopBeslutningKonflikt[] {
  const konflikter: InnkjopBeslutningKonflikt[] = []
  for (const innkjop of innkjopsplan) {
    if (!innkjop.prodkode || !innkjop.planlagtInnkjopsdato) continue
    const relevante = beslutningsplan.filter((b) => b.knyttetProdkode === innkjop.prodkode)
    for (const beslutning of relevante) {
      if (beslutning.fristDato && beslutning.fristDato > innkjop.planlagtInnkjopsdato) {
        konflikter.push({
          innkjop,
          beslutning,
          melding: `"${innkjop.entreprise}" er planlagt kjøpt inn ${innkjop.planlagtInnkjopsdato}, men avklaringen "${beslutning.tema}" har frist først ${beslutning.fristDato}.`,
        })
      }
    }
  }
  return konflikter
}

export function computeBraPris(budsjettPlussGodkjenteEndringer: number, sluttkost: number, braI?: number) {
  if (!braI || braI <= 0) return null
  return {
    budsjettPrKvm: budsjettPlussGodkjenteEndringer / braI,
    sluttkostPrKvm: sluttkost / braI,
  }
}

export function formatKr(n: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n)
}

export function formatPercent(n: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'percent', maximumFractionDigits: 1 }).format(n)
}

export interface FullAnalysis {
  faktureringsplan: FaktureringsplanSummary
  budget: BudgetSummary
  sCurve: SCurveData
  prodkoder: ProdkodeAnalyse[]
  endringer: EndringOversikt
  leverandorer: LeverandorSum[]
  innkjopKonflikter: InnkjopBeslutningKonflikt[]
  braPris: ReturnType<typeof computeBraPris>
}

export function runFullAnalysis(data: ProjectDataSet): FullAnalysis {
  const faktureringsplan = summarizeFaktureringsplan(data.faktureringsplan)
  const budget = summarizeBudget(data.prosjektinfo, data.endringslogg)
  const sCurve = buildSCurve(data.faktureringsplan, data.fakturaer, data.prosjektinfo)
  const prodkoder = analyzeProdkoder(data.prosjektinfo, faktureringsplan)
  const endringer = summarizeEndringer(data.endringslogg)
  const leverandorer = topLeverandorer(data.fakturaer)
  const innkjopKonflikter = findInnkjopBeslutningKonflikter(data.innkjopsplan, data.beslutningsplan)
  const braPris = computeBraPris(budget.budsjettPlussGodkjenteEndringer, budget.sluttkost, data.braI)
  return { faktureringsplan, budget, sCurve, prodkoder, endringer, leverandorer, innkjopKonflikter, braPris }
}
