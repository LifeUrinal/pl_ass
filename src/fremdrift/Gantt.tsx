import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react'
import type { Aktivitet, Firma, Zoom } from './types'
import {
  MANEDER,
  MANEDER_KORT,
  delerAvDag,
  forsteIManed,
  iDag,
  kortDato,
  leggTilDager,
  nesteManed,
  tilDag,
  ukedag,
  ukenummer,
} from './dato'
import { initialer } from './logikk'

const RAD_H = 40
const VENSTRE_B = 300
const HODE_H = 52
const PX_PER_DAG: Record<Zoom, number> = { dag: 32, uke: 14, maned: 4 }

export type Rad =
  | {
      type: 'gruppe'
      id: string
      navn: string
      antall: number
      lukket: boolean
      spenn: { start: string; slutt: string } | null
      fremdrift: number
    }
  | { type: 'akt'; a: Aktivitet }

interface Props {
  rader: Rad[]
  /** Hele planens tidsrom (alle aktiviteter, ikke bare filtrerte) – holder tidsaksen stabil. */
  omfang: { start: string; slutt: string } | null
  zoom: Zoom
  konflikter: Set<string>
  valgtId: string | null
  firmaer: Map<string, Firma>
  fargeFor: (a: Aktivitet) => string
  onVelg: (id: string | null) => void
  onFlytt: (id: string, start: string, slutt: string) => void
  onKobl: (forgjengerId: string, etterfolgerId: string) => void
  onToggleGruppe: (id: string) => void
  onNyIGruppe: (gruppeId: string) => void
  iDagSignal: number
  piler: 'alle' | 'valgt' | 'ingen'
}

interface Drag {
  id: string
  modus: 'flytt' | 'start' | 'slutt'
  x0: number
  start: string
  slutt: string
  nyStart: string
  nySlutt: string
  flyttet: boolean
}

interface Kobling {
  fraId: string
  x1: number
  y1: number
  x2: number
  y2: number
  malId: string | null
}

const erMilepael = (a: Aktivitet) => a.start === a.slutt && (a.type === 'befaring' || a.type === 'overlevering')

export default function Gantt(props: Props) {
  const { rader, omfang, zoom, konflikter, valgtId, firmaer, fargeFor } = props
  const px = PX_PER_DAG[zoom]
  const idag = iDag()
  const idagDag = tilDag(idag)

  // --- Tidsakse -----------------------------------------------------------
  const { fraD, tilD } = useMemo(() => {
    const min = Math.min(idagDag, omfang ? tilDag(omfang.start) : idagDag) - 21
    const max = Math.max(idagDag, omfang ? tilDag(omfang.slutt) : idagDag) + (zoom === 'maned' ? 240 : 60)
    let f = min - ukedag(min) // start på en mandag
    let t = max
    if (zoom === 'maned') {
      f = forsteIManed(min)
      t = nesteManed(max) - 1
    }
    return { fraD: f, tilD: t }
  }, [omfang, idagDag, zoom])
  const bredde = (tilD - fraD + 1) * px
  const xFor = (iso: string) => (tilDag(iso) - fraD) * px

  // --- Scroll: hold samme dato i midten ved zoom, hopp til i dag ved signal ---
  const scrollRef = useRef<HTMLDivElement>(null)
  const midtDag = useRef<number | null>(null)
  const forrige = useRef({ px, fraD })
  const sporMidt = () => {
    const el = scrollRef.current
    if (!el) return
    midtDag.current = fraD + (el.scrollLeft + (el.clientWidth - VENSTRE_B) / 2) / forrige.current.px
  }

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const p = forrige.current
    if (p.px !== px && midtDag.current !== null) {
      el.scrollLeft = (midtDag.current - fraD) * px - (el.clientWidth - VENSTRE_B) / 2
    } else if (p.fraD !== fraD) {
      el.scrollLeft += (p.fraD - fraD) * px
    }
    forrige.current = { px, fraD }
    sporMidt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, fraD])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({
      left: (idagDag - fraD) * px - (el.clientWidth - VENSTRE_B) * 0.3,
      behavior: props.iDagSignal ? 'smooth' : 'auto',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.iDagSignal])

  // --- Dra for å flytte / endre lengde ------------------------------------
  const dragRef = useRef<Drag | null>(null)
  const [forhand, setForhand] = useState<{ id: string; start: string; slutt: string } | null>(null)

  function startDrag(e: RPointerEvent, a: Aktivitet, modus: Drag['modus']) {
    if (e.button !== 0) return
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    dragRef.current = { id: a.id, modus, x0: e.clientX, start: a.start, slutt: a.slutt, nyStart: a.start, nySlutt: a.slutt, flyttet: false }
  }

  function draBevegelse(e: RPointerEvent) {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.x0
    if (!d.flyttet && Math.abs(dx) < 4) return
    d.flyttet = true
    const dd = Math.round(dx / px)
    let s = d.start
    let t = d.slutt
    if (d.modus === 'flytt') {
      s = leggTilDager(d.start, dd)
      t = leggTilDager(d.slutt, dd)
    } else if (d.modus === 'start') {
      s = leggTilDager(d.start, dd)
      if (s > d.slutt) s = d.slutt
    } else {
      t = leggTilDager(d.slutt, dd)
      if (t < d.start) t = d.start
    }
    if (s !== d.nyStart || t !== d.nySlutt) {
      d.nyStart = s
      d.nySlutt = t
      setForhand({ id: d.id, start: s, slutt: t })
    }
  }

  function draSlutt() {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    setForhand(null)
    if (!d.flyttet) props.onVelg(d.id)
    else if (d.nyStart !== d.start || d.nySlutt !== d.slutt) props.onFlytt(d.id, d.nyStart, d.nySlutt)
  }

  // --- Dra fra prikken for å lage en avhengighet ---------------------------
  const lagRef = useRef<HTMLDivElement>(null)
  const [kobling, setKobling] = useState<Kobling | null>(null)

  function lokal(e: { clientX: number; clientY: number }) {
    const r = lagRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function aktUnder(e: { clientX: number; clientY: number }): string | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    return el?.closest('[data-akt]')?.getAttribute('data-akt') ?? null
  }

  function startKobling(e: RPointerEvent, a: Aktivitet, x: number, y: number) {
    if (e.button !== 0) return
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setKobling({ fraId: a.id, x1: x, y1: y, x2: x, y2: y, malId: null })
  }
  function koblingBevegelse(e: RPointerEvent) {
    if (!kobling) return
    e.stopPropagation()
    const p = lokal(e)
    const mal = aktUnder(e)
    setKobling({ ...kobling, x2: p.x, y2: p.y, malId: mal && mal !== kobling.fraId ? mal : null })
  }
  function koblingSlutt(e: RPointerEvent) {
    if (!kobling) return
    e.stopPropagation()
    const mal = aktUnder(e)
    if (mal && mal !== kobling.fraId) props.onKobl(kobling.fraId, mal)
    setKobling(null)
  }

  // --- Posisjoner -----------------------------------------------------------
  const visAkt = (a: Aktivitet) => (forhand && forhand.id === a.id ? { ...a, ...forhand } : a)
  const posisjon = new Map<string, { x1: number; x2: number; y: number; milepael: boolean }>()
  rader.forEach((r, i) => {
    if (r.type !== 'akt') return
    const a = visAkt(r.a)
    const m = erMilepael(a)
    const x1 = xFor(a.start)
    const x2 = m ? x1 + px / 2 + 8 : xFor(a.slutt) + px
    posisjon.set(a.id, { x1: m ? x1 + px / 2 - 8 : x1, x2, y: i * RAD_H + RAD_H / 2, milepael: m })
  })

  const akter = new Map<string, Aktivitet>()
  for (const r of rader) if (r.type === 'akt') akter.set(r.a.id, visAkt(r.a))

  const piler: { d: string; konflikt: boolean; key: string; markert: boolean }[] = []
  for (const r of rader) {
    if (r.type !== 'akt') continue
    const til = posisjon.get(r.a.id)
    if (!til) continue
    for (const fId of r.a.avhengerAv) {
      if (props.piler === 'ingen') break
      if (props.piler === 'valgt' && valgtId !== r.a.id && valgtId !== fId) continue
      const fra = posisjon.get(fId)
      if (!fra) continue
      const x1 = fra.x2
      const y1 = fra.y
      const x2 = til.x1
      const y2 = til.y
      let d: string
      if (x2 - x1 >= 16) {
        d = `M${x1},${y1} H${x1 + 8} V${y2} H${x2 - 2}`
      } else {
        const ym = y2 + (y2 > y1 ? -RAD_H / 2 : RAD_H / 2)
        d = `M${x1},${y1} H${x1 + 8} V${ym} H${x2 - 12} V${y2} H${x2 - 2}`
      }
      piler.push({
        d,
        key: `${fId}>${r.a.id}`,
        konflikt: tilDag(visAkt(r.a).start) <= tilDag(akter.get(fId)!.slutt),
        markert: valgtId === r.a.id || valgtId === fId,
      })
    }
  }

  const hoyde = rader.length * RAD_H
  const antallAkt = rader.filter((r) => r.type === 'akt').length

  return (
    <div className="fd-gantt" ref={scrollRef} onScroll={sporMidt}>
      <div className="fd-innhold" style={{ width: VENSTRE_B + bredde }}>
        <Hode fraD={fraD} tilD={tilD} px={px} zoom={zoom} idagDag={idagDag} antall={antallAkt} />

        <div className="fd-kropp" style={{ height: Math.max(hoyde, 200) }}>
          {/* Bakgrunn: helger, månedsskiller og i-dag-linje */}
          <Bakgrunn fraD={fraD} tilD={tilD} px={px} zoom={zoom} hoyde={Math.max(hoyde, 200)} idagDag={idagDag} />

          {rader.map((r, i) =>
            r.type === 'gruppe' ? (
              <div className="fd-rad fd-rad-gruppe" key={'g' + r.id} style={{ top: i * RAD_H }}>
                <div className="fd-venstre" onClick={() => props.onToggleGruppe(r.id)}>
                  <span className={`fd-chevron ${r.lukket ? '' : 'apen'}`}>›</span>
                  <span className="fd-gruppenavn">{r.navn}</span>
                  <span className="fd-antall">{r.antall}</span>
                  {r.id !== 'alle' && (
                    <button
                      className="fd-pluss"
                      title="Ny aktivitet i denne gruppen"
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onNyIGruppe(r.id)
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                {r.spenn && (
                  <div
                    className="fd-sammendrag"
                    style={{ left: VENSTRE_B + xFor(r.spenn.start), width: xFor(r.spenn.slutt) + px - xFor(r.spenn.start) }}
                  >
                    <div style={{ width: `${r.fremdrift}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <AktivitetRad
                key={r.a.id}
                a={visAkt(r.a)}
                top={i * RAD_H}
                px={px}
                xFor={xFor}
                farge={fargeFor(r.a)}
                firma={r.a.firmaId ? firmaer.get(r.a.firmaId) : undefined}
                konflikt={konflikter.has(r.a.id)}
                valgt={valgtId === r.a.id}
                koblingsmal={kobling?.malId === r.a.id}
                draes={forhand?.id === r.a.id}
                onVelg={() => props.onVelg(r.a.id)}
                startDrag={startDrag}
                draBevegelse={draBevegelse}
                draSlutt={draSlutt}
                startKobling={startKobling}
                koblingBevegelse={koblingBevegelse}
                koblingSlutt={koblingSlutt}
                y={i * RAD_H + RAD_H / 2}
              />
            ),
          )}

          {/* Avhengighetspiler */}
          <div className="fd-lag" ref={lagRef} style={{ left: VENSTRE_B, width: bredde, height: hoyde }}>
            <svg width={bredde} height={hoyde}>
              <defs>
                {['normal', 'markert', 'konflikt'].map((k) => (
                  <marker key={k} id={`pil-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0,0 L8,4 L0,8 z" className={`fd-pilhode ${k}`} />
                  </marker>
                ))}
              </defs>
              {piler.map((p) => {
                const k = p.konflikt ? 'konflikt' : p.markert ? 'markert' : 'normal'
                return <path key={p.key} d={p.d} className={`fd-pil ${k}`} markerEnd={`url(#pil-${k})`} />
              })}
              {kobling && (
                <line x1={kobling.x1} y1={kobling.y1} x2={kobling.x2} y2={kobling.y2} className="fd-pil markert" strokeDasharray="4 3" />
              )}
            </svg>
          </div>

          {forhand && (
            <div className="fd-dra-info" style={{ left: VENSTRE_B + xFor(forhand.start), top: (rader.findIndex((r) => r.type === 'akt' && r.a.id === forhand.id) - 0.7) * RAD_H }}>
              {kortDato(forhand.start)} – {kortDato(forhand.slutt)}
            </div>
          )}
        </div>
      </div>
      {rader.length === 0 && <div className="fd-tomt">Ingen aktiviteter å vise.</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface RadProps {
  a: Aktivitet
  top: number
  y: number
  px: number
  xFor: (iso: string) => number
  farge: string
  firma?: Firma
  konflikt: boolean
  valgt: boolean
  koblingsmal: boolean
  draes: boolean
  onVelg: () => void
  startDrag: (e: RPointerEvent, a: Aktivitet, modus: Drag['modus']) => void
  draBevegelse: (e: RPointerEvent) => void
  draSlutt: () => void
  startKobling: (e: RPointerEvent, a: Aktivitet, x: number, y: number) => void
  koblingBevegelse: (e: RPointerEvent) => void
  koblingSlutt: (e: RPointerEvent) => void
}

function AktivitetRad(p: RadProps) {
  const { a, px, farge, firma } = p
  const x = p.xFor(a.start)
  const w = p.xFor(a.slutt) + px - x
  const milepael = erMilepael(a)
  const stil = { '--c': farge } as CSSProperties
  const klasser = ['fd-bar', p.valgt && 'valgt', p.konflikt && 'konflikt', p.koblingsmal && 'mal', p.draes && 'draes']
    .filter(Boolean)
    .join(' ')
  const innvendigTekst = w >= 110

  return (
    <div className={`fd-rad ${p.valgt ? 'valgt' : ''}`} style={{ top: p.top }}>
      <div className="fd-venstre fd-akt" onClick={p.onVelg} data-akt={a.id}>
        <span className="fd-avatar" style={{ background: firma?.farge ?? '#c4c9d1' }} title={firma?.navn ?? 'Ingen firma'}>
          {firma ? initialer(firma.navn) : '–'}
        </span>
        <span className="fd-navn" title={a.navn}>
          {a.navn}
        </span>
        {p.konflikt && (
          <span className="fd-varsel" title="Starter før en aktivitet den avhenger av er ferdig">
            !
          </span>
        )}
        <span className="fd-dato">{kortDato(a.slutt)}</span>
      </div>

      {milepael ? (
        <div
          className={`fd-milepael ${p.valgt ? 'valgt' : ''} ${p.konflikt ? 'konflikt' : ''} ${p.koblingsmal ? 'mal' : ''}`}
          style={{ ...stil, left: VENSTRE_B + x + px / 2 }}
          data-akt={a.id}
          onPointerDown={(e) => p.startDrag(e, a, 'flytt')}
          onPointerMove={p.draBevegelse}
          onPointerUp={p.draSlutt}
        >
          <div className="fd-diamant" />
          <span className="fd-milepael-tekst">
            {a.navn} <span className="muted">{kortDato(a.start)}</span>
          </span>
        </div>
      ) : (
        <>
          <div
            className={klasser}
            style={{ ...stil, left: VENSTRE_B + x, width: Math.max(w, 4) }}
            data-akt={a.id}
            title={`${a.navn}\n${kortDato(a.start)} – ${kortDato(a.slutt)} · ${a.fremdrift}%`}
            onPointerDown={(e) => p.startDrag(e, a, 'flytt')}
            onPointerMove={p.draBevegelse}
            onPointerUp={p.draSlutt}
          >
            <div className="fd-bar-indre">
              <div className="fd-bar-fyll" style={{ width: `${a.fremdrift}%` }} />
              {innvendigTekst && <span className="fd-bar-tekst">{a.navn}</span>}
              {w >= 150 && <span className="fd-bar-pst">{a.fremdrift}%</span>}
            </div>
            <div className="fd-handtak v" onPointerDown={(e) => p.startDrag(e, a, 'start')} />
            <div className="fd-handtak h" onPointerDown={(e) => p.startDrag(e, a, 'slutt')} />
            <div
              className="fd-koblingsprikk"
              title="Dra til en annen aktivitet for å lage en avhengighet"
              onPointerDown={(e) => p.startKobling(e, a, x + w, p.y)}
              onPointerMove={p.koblingBevegelse}
              onPointerUp={p.koblingSlutt}
            />
          </div>
          {!innvendigTekst && (
            <span className="fd-bar-utenfor" style={{ left: VENSTRE_B + x + w + 14 }}>
              {a.navn}
            </span>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Hode({ fraD, tilD, px, zoom, idagDag, antall }: { fraD: number; tilD: number; px: number; zoom: Zoom; idagDag: number; antall: number }) {
  const ovre: { x: number; w: number; tekst: string }[] = []
  const nedre: { x: number; w: number; tekst: string; helg?: boolean }[] = []

  if (zoom === 'maned') {
    // øvre: år, nedre: måneder
    let d = fraD
    while (d <= tilD) {
      const n = nesteManed(d)
      const { ar, mnd } = delerAvDag(d)
      nedre.push({ x: (d - fraD) * px, w: (n - d) * px, tekst: MANEDER_KORT[mnd] })
      if (mnd === 0 || d === fraD) {
        const nesteAr = Math.round(Date.UTC(ar + 1, 0, 1) / 86_400_000)
        ovre.push({ x: (d - fraD) * px, w: (Math.min(nesteAr, tilD + 1) - d) * px, tekst: String(ar) })
      }
      d = n
    }
  } else {
    let d = fraD
    while (d <= tilD) {
      const n = Math.min(nesteManed(d), tilD + 1)
      const { ar, mnd } = delerAvDag(d)
      ovre.push({ x: (d - fraD) * px, w: (n - d) * px, tekst: `${MANEDER[mnd]} ${ar}` })
      d = n
    }
    if (zoom === 'dag') {
      for (let d = fraD; d <= tilD; d++) nedre.push({ x: (d - fraD) * px, w: px, tekst: String(delerAvDag(d).dag), helg: ukedag(d) >= 5 })
    } else {
      for (let d = fraD; d <= tilD; d += 7) nedre.push({ x: (d - fraD) * px, w: 7 * px, tekst: `uke ${ukenummer(d)}` })
    }
  }

  return (
    <div className="fd-hode" style={{ height: HODE_H }}>
      <div className="fd-hode-venstre">
        <span>{antall} aktiviteter</span>
        <span>Slutt</span>
      </div>
      <div className="fd-hode-tid">
        <div className="fd-hode-rad">
          {ovre.map((o) => (
            <div key={o.x} className="fd-hode-celle ovre" style={{ left: o.x, width: o.w }}>
              <span>{o.tekst}</span>
            </div>
          ))}
        </div>
        <div className="fd-hode-rad">
          {nedre.map((o) => (
            <div key={o.x} className={`fd-hode-celle nedre ${o.helg ? 'helg' : ''}`} style={{ left: o.x, width: o.w }}>
              {o.tekst}
            </div>
          ))}
        </div>
        <div className="fd-idag-merke" style={{ left: (idagDag - fraD) * px + px / 2 }}>
          I dag
        </div>
      </div>
    </div>
  )
}

function Bakgrunn({ fraD, tilD, px, zoom, hoyde, idagDag }: { fraD: number; tilD: number; px: number; zoom: Zoom; hoyde: number; idagDag: number }) {
  const linjer: number[] = []
  for (let d = forsteIManed(fraD); d <= tilD; d = nesteManed(d)) if (d > fraD) linjer.push((d - fraD) * px)
  // fraD er alltid en mandag i dag-/ukevisning, så helgestripene kan tegnes som et gjentagende mønster
  const helg =
    zoom === 'maned'
      ? undefined
      : `repeating-linear-gradient(90deg, transparent 0 ${5 * px}px, var(--fd-helg) ${5 * px}px ${7 * px}px)`
  return (
    <div className="fd-bakgrunn" style={{ left: VENSTRE_B, width: (tilD - fraD + 1) * px, height: hoyde, backgroundImage: helg }}>
      {linjer.map((x) => (
        <div key={x} className="fd-manedslinje" style={{ left: x }} />
      ))}
      <div className="fd-idag-linje" style={{ left: (idagDag - fraD) * px + px / 2 }} />
    </div>
  )
}
