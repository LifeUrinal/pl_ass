import { useEffect, useRef, useState } from 'react'
import type { Aktivitet, AktivitetType, Fremdriftsplan } from './types'
import { AKTIVITET_TYPER } from './types'
import { antallDager, arbeidsdager, iDag, kortDato, leggTilDager } from './dato'
import { STATUS_TEKST, etterfolgere, konflikterFor, lagerSirkel, statusFor } from './logikk'

interface Props {
  plan: Fremdriftsplan
  aktivitet: Aktivitet
  posisjon: { nr: number; av: number }
  fokuserNavn: boolean
  onEndre: (patch: Partial<Aktivitet>, samleNokkel?: string) => void
  onVelg: (id: string | null) => void
  onForrige: () => void
  onNeste: () => void
  onSlett: () => void
  onFlyttEtterForgjengere: () => void
  onSkyvEtterfolgere: () => void
}

export default function Detaljpanel(props: Props) {
  const { plan, aktivitet: a, onEndre } = props
  const map = new Map(plan.aktiviteter.map((x) => [x.id, x]))
  const egneKonflikter = konflikterFor(a, map)
  const blokkerer = etterfolgere(a.id, plan.aktiviteter)
  const blokkererIKonflikt = blokkerer.filter((b) => b.start <= a.slutt)
  const status = statusFor(a, egneKonflikter.length > 0, iDag())
  const navnRef = useRef<HTMLInputElement>(null)
  const [visLeggTil, setVisLeggTil] = useState(false)

  useEffect(() => {
    if (props.fokuserNavn) {
      navnRef.current?.focus()
      navnRef.current?.select()
    }
  }, [a.id, props.fokuserNavn])

  useEffect(() => setVisLeggTil(false), [a.id])

  function settStart(start: string) {
    if (!start) return
    // flytt start, behold sluttdato (men aldri før start)
    onEndre({ start, slutt: a.slutt < start ? start : a.slutt })
  }
  function settSlutt(slutt: string) {
    if (!slutt) return
    onEndre({ slutt, start: a.start > slutt ? slutt : a.start })
  }

  const kandidater = plan.aktiviteter
    .filter((x) => x.id !== a.id && !a.avhengerAv.includes(x.id) && !lagerSirkel(a.id, x.id, plan.aktiviteter))
    .sort((x, y) => x.navn.localeCompare(y.navn, 'nb'))
  const omradeNavn = (id: string | null) => plan.omrader.find((o) => o.id === id)?.navn ?? 'Uten område'
  const kandidatGrupper = [...new Set(kandidater.map((k) => omradeNavn(k.omradeId)))].sort((x, y) => x.localeCompare(y, 'nb'))

  return (
    <aside className="fd-panel">
      <div className="fd-panel-topp">
        <button className="fd-ikonknapp" onClick={() => props.onVelg(null)} title="Lukk (Esc)">
          ✕
        </button>
        <span className="muted small">
          {props.posisjon.nr} av {props.posisjon.av}
        </span>
        <div>
          <button className="fd-ikonknapp" onClick={props.onForrige} title="Forrige">
            ‹
          </button>
          <button className="fd-ikonknapp" onClick={props.onNeste} title="Neste">
            ›
          </button>
        </div>
      </div>

      <span className={`pill ${STATUS_TEKST[status].klasse}`}>{STATUS_TEKST[status].tekst}</span>

      <input
        ref={navnRef}
        className="fd-tittel-input"
        value={a.navn}
        placeholder="Navn på aktivitet"
        onChange={(e) => onEndre({ navn: e.target.value }, 'navn:' + a.id)}
      />

      <div className="fd-felt">
        <label>Område</label>
        <select value={a.omradeId ?? ''} onChange={(e) => onEndre({ omradeId: e.target.value || null })}>
          <option value="">– Uten område –</option>
          {plan.omrader.map((o) => (
            <option key={o.id} value={o.id}>
              {o.navn}
            </option>
          ))}
        </select>
      </div>
      <div className="fd-felt">
        <label>Firma (UE)</label>
        <select value={a.firmaId ?? ''} onChange={(e) => onEndre({ firmaId: e.target.value || null })}>
          <option value="">– Ikke tildelt –</option>
          {plan.firmaer.map((f) => (
            <option key={f.id} value={f.id}>
              {f.navn}
            </option>
          ))}
        </select>
      </div>
      <div className="fd-felt">
        <label>Type</label>
        <select value={a.type} onChange={(e) => onEndre({ type: e.target.value as AktivitetType })}>
          {AKTIVITET_TYPER.map((t) => (
            <option key={t.id} value={t.id}>
              {t.navn}
            </option>
          ))}
        </select>
      </div>

      <div className="fd-felt">
        <label>Start</label>
        <div className="fd-dato-rad">
          <input type="date" value={a.start} onChange={(e) => settStart(e.target.value)} />
          <button className="fd-steg" onClick={() => onEndre({ start: leggTilDager(a.start, -1), slutt: leggTilDager(a.slutt, -1) })} title="Flytt én dag tidligere">
            −
          </button>
          <button className="fd-steg" onClick={() => onEndre({ start: leggTilDager(a.start, 1), slutt: leggTilDager(a.slutt, 1) })} title="Flytt én dag senere">
            +
          </button>
        </div>
      </div>
      <div className="fd-felt">
        <label>Slutt</label>
        <div className="fd-dato-rad">
          <input type="date" value={a.slutt} min={a.start} onChange={(e) => settSlutt(e.target.value)} />
          <button className="fd-steg" disabled={a.slutt <= a.start} onClick={() => settSlutt(leggTilDager(a.slutt, -1))} title="Én dag kortere">
            −
          </button>
          <button className="fd-steg" onClick={() => settSlutt(leggTilDager(a.slutt, 1))} title="Én dag lengre">
            +
          </button>
        </div>
      </div>
      <div className="fd-felt">
        <label>Varighet</label>
        <div>
          <strong>{antallDager(a.start, a.slutt)} dager</strong> <span className="muted">{arbeidsdager(a.start, a.slutt)} arbeidsdager</span>
        </div>
      </div>
      <div className="fd-felt">
        <label>Fremdrift</label>
        <div className="fd-fremdrift-rad">
          <input type="range" min={0} max={100} step={5} value={a.fremdrift} onChange={(e) => onEndre({ fremdrift: Number(e.target.value) }, 'fremdrift:' + a.id)} />
          <strong>{a.fremdrift}%</strong>
        </div>
      </div>

      {egneKonflikter.length > 0 && (
        <div className="fd-konfliktboks">
          Starter før {egneKonflikter.map((k) => `«${k.navn}»`).join(', ')} er ferdig ({kortDato(egneKonflikter.map((k) => k.slutt).sort().reverse()[0])}).
          <button className="btn-secondary fd-liten-knapp" onClick={props.onFlyttEtterForgjengere}>
            Flytt til etter avhengighetene
          </button>
        </div>
      )}
      {blokkererIKonflikt.length > 0 && (
        <div className="fd-konfliktboks">
          {blokkererIKonflikt.length} etterfølgende aktivitet(er) starter før denne er ferdig.
          <button className="btn-secondary fd-liten-knapp" onClick={props.onSkyvEtterfolgere}>
            Skyv etterfølgende aktiviteter
          </button>
        </div>
      )}

      <div className="fd-seksjon">
        <h4>
          Avhenger av <span className="muted">{a.avhengerAv.length}</span>
        </h4>
        {a.avhengerAv.map((id) => {
          const f = map.get(id)
          if (!f) return null
          const k = egneKonflikter.includes(f)
          return (
            <div key={id} className="fd-avh">
              <span className={`fd-avh-ikon ${f.fremdrift >= 100 ? 'ferdig' : ''} ${k ? 'konflikt' : ''}`}>{f.fremdrift >= 100 ? '✓' : k ? '!' : ''}</span>
              <button className="fd-lenke" onClick={() => props.onVelg(f.id)}>
                {f.navn}
              </button>
              <span className="muted small">slutter {kortDato(f.slutt)}</span>
              <button className="fd-ikonknapp liten" title="Fjern avhengighet" onClick={() => onEndre({ avhengerAv: a.avhengerAv.filter((x) => x !== id) })}>
                ✕
              </button>
            </div>
          )
        })}
        {visLeggTil ? (
          <select
            autoFocus
            value=""
            onBlur={() => setVisLeggTil(false)}
            onChange={(e) => {
              if (e.target.value) onEndre({ avhengerAv: [...a.avhengerAv, e.target.value] })
              setVisLeggTil(false)
            }}
          >
            <option value="">Velg aktivitet…</option>
            {kandidatGrupper.map((g) => (
              <optgroup key={g} label={g}>
                {kandidater
                  .filter((k) => omradeNavn(k.omradeId) === g)
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.navn} (slutter {kortDato(k.slutt)})
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <button className="fd-lenke muted" onClick={() => setVisLeggTil(true)}>
            + Legg til avhengighet
          </button>
        )}
      </div>

      <div className="fd-seksjon">
        <h4>
          Blokkerer <span className="muted">{blokkerer.length}</span>
        </h4>
        {blokkerer.length === 0 && <div className="muted small">Ingen aktiviteter venter på denne.</div>}
        {blokkerer.map((b) => (
          <div key={b.id} className="fd-avh">
            <span className={`fd-avh-ikon tom ${blokkererIKonflikt.includes(b) ? 'konflikt' : ''}`}>{blokkererIKonflikt.includes(b) ? '!' : ''}</span>
            <button className="fd-lenke" onClick={() => props.onVelg(b.id)}>
              {b.navn}
            </button>
            <span className="muted small">starter {kortDato(b.start)}</span>
          </div>
        ))}
      </div>

      <div className="fd-seksjon">
        <h4>Notat</h4>
        <textarea rows={3} value={a.notat ?? ''} placeholder="F.eks. forutsetninger, kontaktperson, sjekkliste…" onChange={(e) => onEndre({ notat: e.target.value }, 'notat:' + a.id)} />
      </div>

      <div className="fd-panel-bunn">
        <button className="fd-slett" onClick={props.onSlett}>
          Slett aktivitet
        </button>
        <span className="muted small">I dag er {kortDato(iDag())}</span>
      </div>
    </aside>
  )
}
