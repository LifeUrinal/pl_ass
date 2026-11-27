import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Aktivitet, FargeEtter, Fremdriftsplan, GrupperEtter, Visning, Zoom } from './types'
import { AKTIVITET_TYPER } from './types'
import { FELLESFERIE_UKER, iDag, leggTilDager } from './dato'
import {
  OMRADE_FARGER,
  byggIdFor,
  omradeFullNavn,
  filtrer,
  finnKonflikter,
  flyttEtterForgjengere,
  grupper,
  lagerSirkel,
  nyId,
  samletFremdrift,
  skyvEtterfolgere,
  spenn,
} from './logikk'
import { TOM_PLAN, eksempelplan, lagrePlan, lastPlan } from './lagring'
import { eksporterExcel, importerExcel } from './excel'
import Gantt from './Gantt'
import type { Rad } from './Gantt'
import type { Gruppe, GruppeFelt } from './logikk'
import Detaljpanel from './Detaljpanel'
import RegisterModal from './RegisterModal'

// Små brukerinnstillinger huskes i nettleseren
function useHusk<T extends string>(nokkel: string, standard: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem('fremdrift:' + nokkel) as T) || standard
    } catch {
      return standard
    }
  })
  const sett = useCallback(
    (ny: T) => {
      setV(ny)
      try {
        localStorage.setItem('fremdrift:' + nokkel, ny)
      } catch {
        /* ignorer */
      }
    },
    [nokkel],
  )
  return [v, sett]
}

interface Historikk {
  forrige: Fremdriftsplan[]
  na: Fremdriftsplan
  sisteNokkel?: string
  sisteTid?: number
}

export default function Fremdrift() {
  const [hist, setHist] = useState<Historikk | null>(null)
  const plan = hist?.na

  const [grupperEtter, setGrupperEtter] = useHusk<GrupperEtter>('grupper', 'bygg-omrade')
  const [byggFilter, setByggFilter] = useState('')
  const [fargeEtter, setFargeEtter] = useHusk<FargeEtter>('farge', 'type')
  const [zoom, setZoom] = useHusk<Zoom>('zoom', 'uke')
  const [visning, setVisning] = useState<Visning>('alle')
  const [sok, setSok] = useState('')
  const [valgtId, setValgtId] = useState<string | null>(null)
  const [nyId_, setNyId] = useState<string | null>(null) // nylig opprettet → fokuser navnefelt
  const [lukket, setLukket] = useState<Set<string>>(new Set())
  const [piler, setPiler] = useHusk<'alle' | 'valgt' | 'ingen'>('piler', 'alle')
  const [autoSkyv, setAutoSkyv] = useHusk<'ja' | 'nei'>('autoskyv', 'nei')
  const [visRegister, setVisRegister] = useState(false)
  const [iDagSignal, setIDagSignal] = useState(0)
  const filRef = useRef<HTMLInputElement>(null)
  const menyRef = useRef<HTMLDetailsElement>(null)
  const idag = iDag()

  // --- Last og lagre --------------------------------------------------------
  useEffect(() => {
    lastPlan().then((p) => setHist({ forrige: [], na: p ?? eksempelplan() }))
  }, [])
  useEffect(() => {
    if (plan) lagrePlan(plan)
  }, [plan])

  /** Alle endringer går gjennom her, slik at de kan angres. Endringer med samme samleNokkel innen 1,5 s slås sammen (f.eks. skriving). */
  const endre = useCallback((fn: (p: Fremdriftsplan) => Fremdriftsplan, samleNokkel?: string) => {
    setHist((h) => {
      if (!h) return h
      const ny = fn(h.na)
      if (ny === h.na) return h
      const na = Date.now()
      const slaSammen = samleNokkel && h.sisteNokkel === samleNokkel && na - (h.sisteTid ?? 0) < 1500
      return {
        forrige: slaSammen ? h.forrige : [...h.forrige.slice(-49), h.na],
        na: ny,
        sisteNokkel: samleNokkel,
        sisteTid: na,
      }
    })
  }, [])

  const angre = useCallback(() => {
    setHist((h) => (h && h.forrige.length ? { forrige: h.forrige.slice(0, -1), na: h.forrige[h.forrige.length - 1] } : h))
  }, [])

  const endreAktivitet = useCallback(
    (id: string, patch: Partial<Aktivitet>, samleNokkel?: string) => {
      endre((p) => {
        let akt = p.aktiviteter.map((a) => (a.id === id ? { ...a, ...patch } : a))
        if (autoSkyv === 'ja' && ('start' in patch || 'slutt' in patch)) akt = skyvEtterfolgere(akt, id)
        return { ...p, aktiviteter: akt }
      }, samleNokkel)
    },
    [endre, autoSkyv],
  )

  // --- Avledede data ---------------------------------------------------------
  const konflikter = useMemo(() => finnKonflikter(plan?.aktiviteter ?? []), [plan])
  const synlige = useMemo(() => {
    if (!plan) return []
    const f = filtrer(plan.aktiviteter, visning, sok, konflikter, idag)
    if (!byggFilter) return f
    return f.filter((a) => (byggIdFor(a, plan) ?? '__uten') === byggFilter)
  }, [plan, visning, sok, konflikter, idag, byggFilter])
  const grupperte = useMemo(() => (plan ? grupper(plan, synlige, grupperEtter) : []), [plan, synlige, grupperEtter])

  const rader: Rad[] = useMemo(() => {
    const ut: Rad[] = []
    const leggTil = (g: Gruppe, niva: number) => {
      const erLukket = lukket.has(grupperEtter + '|' + g.nokkel)
      ut.push({
        type: 'gruppe',
        nokkel: g.nokkel,
        id: g.id,
        felt: g.felt,
        niva,
        navn: g.navn,
        antall: g.aktiviteter.length,
        lukket: erLukket,
        spenn: spenn(g.aktiviteter),
        fremdrift: samletFremdrift(g.aktiviteter),
      })
      if (erLukket) return
      if (g.under) g.under.forEach((u) => leggTil(u, niva + 1))
      else for (const a of g.aktiviteter) ut.push({ type: 'akt', a, niva })
    }
    grupperte.forEach((g) => leggTil(g, 0))
    return ut
  }, [grupperte, lukket, grupperEtter])

  const rekkefolge = useMemo(() => {
    const flat = (g: Gruppe): string[] => (g.under ? g.under.flatMap(flat) : g.aktiviteter.map((a) => a.id))
    return grupperte.flatMap(flat)
  }, [grupperte])
  const firmaMap = useMemo(() => new Map((plan?.firmaer ?? []).map((f) => [f.id, f])), [plan])
  const omfang = useMemo(() => spenn(plan?.aktiviteter ?? []), [plan])

  const fargeFor = useCallback(
    (a: Aktivitet) => {
      if (fargeEtter === 'firma') return (a.firmaId && firmaMap.get(a.firmaId)?.farge) || '#9aa3ae'
      if (fargeEtter === 'bygg') {
        const b = plan ? byggIdFor(a, plan) : null
        const i = plan?.bygg.findIndex((x) => x.id === b) ?? -1
        return i >= 0 ? OMRADE_FARGER[i % OMRADE_FARGER.length] : '#9aa3ae'
      }
      if (fargeEtter === 'omrade') {
        const i = plan?.omrader.findIndex((o) => o.id === a.omradeId) ?? -1
        return i >= 0 ? OMRADE_FARGER[i % OMRADE_FARGER.length] : '#9aa3ae'
      }
      return AKTIVITET_TYPER.find((t) => t.id === a.type)!.farge
    },
    [fargeEtter, firmaMap, plan],
  )

  const valgt = plan?.aktiviteter.find((a) => a.id === valgtId) ?? null

  // Lukk åpne nedtrekksmenyer ved klikk utenfor
  useEffect(() => {
    function klikk(e: PointerEvent) {
      document.querySelectorAll('details.fd-meny[open]').forEach((d) => {
        if (!d.contains(e.target as Node)) d.removeAttribute('open')
      })
    }
    document.addEventListener('pointerdown', klikk)
    return () => document.removeEventListener('pointerdown', klikk)
  }, [])

  // --- Hurtigtaster ---------------------------------------------------------
  useEffect(() => {
    function tast(e: KeyboardEvent) {
      const iFelt = (e.target as HTMLElement).closest('input, textarea, select')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !iFelt) {
        e.preventDefault()
        angre()
      } else if (e.key === 'Escape' && !iFelt) {
        setValgtId(null)
      } else if (e.key === '/' && !iFelt) {
        e.preventDefault()
        document.getElementById('fd-sok')?.focus()
      }
    }
    window.addEventListener('keydown', tast)
    return () => window.removeEventListener('keydown', tast)
  }, [angre])

  if (!plan || !hist) return <div className="loading-screen">Laster fremdriftsplan…</div>

  // --- Handlinger -----------------------------------------------------------
  function nyAktivitet(felt?: GruppeFelt, gruppeId?: string | null) {
    const id = nyId()
    // I en bygg-gruppe havner den nye aktiviteten i byggets første område
    const omradeId =
      felt === 'omrade' ? (gruppeId ?? null) : felt === 'bygg' && gruppeId ? (plan!.omrader.find((o) => o.byggId === gruppeId)?.id ?? null) : null
    const a: Aktivitet = {
      id,
      navn: 'Ny aktivitet',
      omradeId,
      firmaId: felt === 'firma' ? (gruppeId ?? null) : null,
      type: felt === 'type' && gruppeId ? (gruppeId as Aktivitet['type']) : 'utforelse',
      start: idag,
      slutt: leggTilDager(idag, 4),
      fremdrift: 0,
      avhengerAv: [],
    }
    endre((p) => ({ ...p, aktiviteter: [...p.aktiviteter, a] }))
    setVisning('alle')
    setSok('')
    setValgtId(id)
    setNyId(id)
    // åpne gruppene den nye aktiviteten havner i
    setLukket((s) => new Set([...s].filter((k) => !k.startsWith(grupperEtter + '|'))))
  }

  function velg(id: string | null) {
    setValgtId(id)
    setNyId(null)
  }

  function kobl(forgjengerId: string, etterfolgerId: string) {
    if (!plan) return
    const etterf = plan.aktiviteter.find((a) => a.id === etterfolgerId)
    if (!etterf || etterf.avhengerAv.includes(forgjengerId)) return
    if (lagerSirkel(etterfolgerId, forgjengerId, plan.aktiviteter)) {
      alert('Den avhengigheten ville gitt en sirkel (aktivitetene ville ventet på hverandre).')
      return
    }
    endreAktivitet(etterfolgerId, { avhengerAv: [...etterf.avhengerAv, forgjengerId] })
    velg(etterfolgerId)
  }

  function slett(id: string) {
    const a = plan!.aktiviteter.find((x) => x.id === id)
    if (!a || !confirm(`Slette «${a.navn}»?`)) return
    endre((p) => ({
      ...p,
      aktiviteter: p.aktiviteter.filter((x) => x.id !== id).map((x) => ({ ...x, avhengerAv: x.avhengerAv.filter((f) => f !== id) })),
    }))
    setValgtId(null)
  }

  function naviger(retning: 1 | -1) {
    if (!valgtId || !rekkefolge.length) return
    const i = rekkefolge.indexOf(valgtId)
    velg(rekkefolge[(i + retning + rekkefolge.length) % rekkefolge.length])
  }

  function toggleGruppe(nokkel: string) {
    setLukket((s) => {
      const n = new Set(s)
      const k = grupperEtter + '|' + nokkel
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })
  }

  async function importer(fil: File) {
    try {
      const { plan: ny, advarsler } = await importerExcel(fil, plan!.prosjektnavn)
      if (!confirm(`Fant ${ny.aktiviteter.length} aktiviteter, ${ny.bygg.length} bygg, ${ny.omrader.length} områder og ${ny.firmaer.length} firmaer.\n\nDette erstatter planen du har nå (du kan angre). Fortsette?`)) return
      endre(() => ({ ...ny, fridager: plan!.fridager }))
      setValgtId(null)
      if (advarsler.length) alert('Importert, med merknader:\n\n' + advarsler.slice(0, 15).join('\n') + (advarsler.length > 15 ? `\n… og ${advarsler.length - 15} til` : ''))
    } catch (e) {
      alert('Kunne ikke lese filen: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function menyValg(fn: () => void) {
    menyRef.current?.removeAttribute('open')
    fn()
  }

  const totalFremdrift = samletFremdrift(plan.aktiviteter)
  const forsinket = plan.aktiviteter.filter((a) => a.slutt < idag && a.fremdrift < 100).length
  const pos = valgt ? { nr: rekkefolge.indexOf(valgt.id) + 1, av: rekkefolge.length } : { nr: 0, av: 0 }

  const forklaring =
    fargeEtter === 'type'
      ? AKTIVITET_TYPER.map((t) => ({ navn: t.navn, farge: t.farge }))
      : fargeEtter === 'firma'
        ? plan.firmaer.map((f) => ({ navn: f.navn, farge: f.farge }))
        : fargeEtter === 'bygg'
          ? plan.bygg.map((b, i) => ({ navn: b.navn, farge: OMRADE_FARGER[i % OMRADE_FARGER.length] }))
          : plan.omrader.map((o, i) => ({ navn: omradeFullNavn(o, plan), farge: OMRADE_FARGER[i % OMRADE_FARGER.length] }))

  return (
    <div className="fd">
      <header className="fd-topp">
        <div className="fd-tittel">
          <input
            className="fd-prosjektnavn"
            value={plan.prosjektnavn}
            onChange={(e) => endre((p) => ({ ...p, prosjektnavn: e.target.value }), 'prosjektnavn')}
            aria-label="Prosjektnavn"
          />
          <span className="muted small">
            {plan.aktiviteter.length} aktiviteter · {totalFremdrift}% ferdig
            {konflikter.size > 0 && (
              <>
                {' · '}
                <button className="fd-lenke fd-rod" onClick={() => setVisning('konflikter')}>
                  {konflikter.size} konflikt{konflikter.size === 1 ? '' : 'er'}
                </button>
              </>
            )}
            {forsinket > 0 && (
              <>
                {' · '}
                <button className="fd-lenke fd-rod" onClick={() => setVisning('forsinket')}>
                  {forsinket} forsinket
                </button>
              </>
            )}
          </span>
        </div>
        <div className="fd-topp-knapper">
          <button className="btn-secondary" onClick={angre} disabled={!hist.forrige.length} title="Angre (Ctrl+Z)">
            ↶ Angre
          </button>
          <button className="btn-secondary" onClick={() => setVisRegister(true)}>
            Bygg og områder
          </button>
          <details className="fd-meny">
            <summary className="btn-secondary" title="Hvilke dager som ikke regnes som arbeidsdager">
              Fridager ▾
            </summary>
            <div className="fd-meny-innhold fd-fridag-meny">
              <div className="muted small">Helger og offentlige helligdager er alltid fridager. I tillegg:</div>
              <label>
                <input
                  type="checkbox"
                  checked={plan.fridager.julOgNyttarsaften}
                  onChange={(e) => endre((p) => ({ ...p, fridager: { ...p.fridager, julOgNyttarsaften: e.target.checked } }))}
                />
                Julaften og nyttårsaften
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={plan.fridager.fellesferie}
                  onChange={(e) => endre((p) => ({ ...p, fridager: { ...p.fridager, fellesferie: e.target.checked } }))}
                />
                Fellesferie, uke
                <select
                  value={plan.fridager.fellesferieStartUke}
                  disabled={!plan.fridager.fellesferie}
                  onChange={(e) => endre((p) => ({ ...p, fridager: { ...p.fridager, fellesferieStartUke: Number(e.target.value) } }))}
                >
                  {[26, 27, 28, 29, 30].map((u) => (
                    <option key={u} value={u}>
                      {u}–{u + FELLESFERIE_UKER - 1}
                    </option>
                  ))}
                </select>
              </label>
              <div className="muted small">Gjelder hele prosjektet og påvirker antall arbeidsdager.</div>
            </div>
          </details>
          <details className="fd-meny" ref={menyRef}>
            <summary className="btn-secondary">Fil ▾</summary>
            <div className="fd-meny-innhold">
              <button onClick={() => menyValg(() => eksporterExcel(plan))}>Eksporter til Excel</button>
              <button onClick={() => menyValg(() => filRef.current?.click())}>Importer fra Excel…</button>
              <hr />
              <button
                onClick={() =>
                  menyValg(() => {
                    if (confirm('Erstatte planen med eksempelplanen? (Du kan angre.)')) {
                      endre(() => eksempelplan())
                      setValgtId(null)
                    }
                  })
                }
              >
                Last inn eksempelplan
              </button>
              <button
                className="fd-rod"
                onClick={() =>
                  menyValg(() => {
                    if (confirm('Starte med en tom plan? (Du kan angre.)')) {
                      endre(() => ({ ...TOM_PLAN }))
                      setValgtId(null)
                    }
                  })
                }
              >
                Start med tom plan
              </button>
            </div>
          </details>
          <input
            ref={filRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importer(f)
              e.target.value = ''
            }}
          />
          <button className="btn-primary" onClick={() => nyAktivitet()}>
            + Ny aktivitet
          </button>
        </div>
      </header>

      <div className="fd-verktoy">
        <div className="fd-sok">
          <input id="fd-sok" value={sok} placeholder="Filtrer aktiviteter…" onChange={(e) => setSok(e.target.value)} />
          <kbd>/</kbd>
        </div>
        <label className="fd-valg">
          Grupper etter
          <select value={grupperEtter} onChange={(e) => setGrupperEtter(e.target.value as GrupperEtter)}>
            <option value="bygg-omrade">Bygg → område</option>
            <option value="bygg">Bygg</option>
            <option value="omrade">Område</option>
            <option value="firma">Firma (UE)</option>
            <option value="type">Aktivitetstype</option>
            <option value="ingen">Ingen gruppering</option>
          </select>
        </label>
        <label className="fd-valg">
          Farge etter
          <select value={fargeEtter} onChange={(e) => setFargeEtter(e.target.value as FargeEtter)}>
            <option value="type">Aktivitetstype</option>
            <option value="firma">Firma (UE)</option>
            <option value="bygg">Bygg</option>
            <option value="omrade">Område</option>
          </select>
        </label>
        {plan.bygg.length > 0 && (
          <label className="fd-valg">
            Bygg
            <select value={byggFilter} onChange={(e) => setByggFilter(e.target.value)}>
              <option value="">Alle bygg</option>
              {plan.bygg.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.navn}
                </option>
              ))}
              {plan.omrader.some((o) => !o.byggId) && <option value="__uten">Uten bygg</option>}
            </select>
          </label>
        )}
        <label className="fd-valg">
          Vis
          <select value={visning} onChange={(e) => setVisning(e.target.value as Visning)}>
            <option value="alle">Alle aktiviteter</option>
            <option value="pagar">Pågår nå</option>
            <option value="neste14">Neste to uker</option>
            <option value="forsinket">Forsinket</option>
            <option value="konflikter">Med konflikter</option>
          </select>
        </label>
        <label className="fd-valg">
          Piler
          <select value={piler} onChange={(e) => setPiler(e.target.value as 'alle' | 'valgt' | 'ingen')} title="Hvilke avhengighetspiler som tegnes">
            <option value="alle">Alle</option>
            <option value="valgt">Kun valgt</option>
            <option value="ingen">Skjul</option>
          </select>
        </label>
        <label className="fd-valg fd-avkrysning" title="Når en aktivitet flyttes eller forlenges, skyves aktivitetene som avhenger av den automatisk fremover.">
          <input type="checkbox" checked={autoSkyv === 'ja'} onChange={(e) => setAutoSkyv(e.target.checked ? 'ja' : 'nei')} />
          Skyv avhengige
        </label>
        <div className="fd-spacer" />
        <div className="fd-segment">
          {(['dag', 'uke', 'maned'] as Zoom[]).map((z) => (
            <button key={z} className={zoom === z ? 'aktiv' : ''} onClick={() => setZoom(z)}>
              {z === 'dag' ? 'Dag' : z === 'uke' ? 'Uke' : 'Måned'}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={() => setIDagSignal((n) => n + 1)}>
          I dag
        </button>
      </div>

      <div className="fd-forklaring">
        {forklaring.map((f) => (
          <span key={f.navn}>
            <i style={{ background: f.farge }} />
            {f.navn}
          </span>
        ))}
        <span className="muted fd-tips">Dra en stolpe for å flytte · dra kantene for å endre lengde · dra prikken til høyre over en annen aktivitet for å lage en avhengighet</span>
      </div>

      <div className="fd-hoved">
        <Gantt
          rader={rader}
          omfang={omfang}
          zoom={zoom}
          konflikter={konflikter}
          valgtId={valgtId}
          firmaer={firmaMap}
          fargeFor={fargeFor}
          onVelg={velg}
          onFlytt={(id, start, slutt) => endreAktivitet(id, { start, slutt })}
          onKobl={kobl}
          onToggleGruppe={toggleGruppe}
          onNyIGruppe={(felt, id) => nyAktivitet(felt, id)}
          iDagSignal={iDagSignal}
          piler={piler}
          fridagValg={plan.fridager}
        />
        {valgt && (
          <Detaljpanel
            plan={plan}
            aktivitet={valgt}
            posisjon={pos}
            fokuserNavn={nyId_ === valgt.id}
            onEndre={(patch, n) => endreAktivitet(valgt.id, patch, n)}
            onVelg={velg}
            onForrige={() => naviger(-1)}
            onNeste={() => naviger(1)}
            onSlett={() => slett(valgt.id)}
            onFlyttEtterForgjengere={() =>
              endre((p) => {
                let akt = flyttEtterForgjengere(p.aktiviteter, valgt.id)
                if (autoSkyv === 'ja') akt = skyvEtterfolgere(akt, valgt.id)
                return { ...p, aktiviteter: akt }
              })
            }
            onSkyvEtterfolgere={() => endre((p) => ({ ...p, aktiviteter: skyvEtterfolgere(p.aktiviteter, valgt.id) }))}
          />
        )}
      </div>

      {visRegister && <RegisterModal plan={plan} onEndre={endre} onLukk={() => setVisRegister(false)} />}
    </div>
  )
}
