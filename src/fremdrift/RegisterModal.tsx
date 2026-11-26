import { useState } from 'react'
import type { Fremdriftsplan } from './types'
import { FIRMA_FARGER, nyId } from './logikk'

interface Props {
  plan: Fremdriftsplan
  onEndre: (fn: (p: Fremdriftsplan) => Fremdriftsplan, samleNokkel?: string) => void
  onLukk: () => void
}

/** Bytter plass på elementet og nærmeste nabo i samme «familie» (f.eks. områder i samme bygg). */
function flytt<T extends { id: string }>(liste: T[], id: string, retning: -1 | 1, sammeFamilie: (x: T) => boolean = () => true): T[] {
  const i = liste.findIndex((x) => x.id === id)
  let j = i + retning
  while (j >= 0 && j < liste.length && !sammeFamilie(liste[j])) j += retning
  if (i < 0 || j < 0 || j >= liste.length) return liste
  const ny = [...liste]
  ;[ny[i], ny[j]] = [ny[j], ny[i]]
  return ny
}

/** Vedlikehold av bygg, områder og firmaer (UE-er). */
export default function RegisterModal({ plan, onEndre, onLukk }: Props) {
  const [nyttBygg, setNyttBygg] = useState('')
  const [nyttOmrade, setNyttOmrade] = useState('')
  const [nyttOmradeBygg, setNyttOmradeBygg] = useState<string>(plan.bygg[0]?.id ?? '')
  const [nyttFirma, setNyttFirma] = useState('')

  const brukOmrade = (id: string) => plan.aktiviteter.filter((a) => a.omradeId === id).length
  const brukFirma = (id: string) => plan.aktiviteter.filter((a) => a.firmaId === id).length
  const omraderI = (byggId: string | null) => plan.omrader.filter((o) => (o.byggId ?? null) === byggId)

  function leggTilBygg() {
    const navn = nyttBygg.trim()
    if (!navn) return
    const id = nyId()
    onEndre((p) => ({ ...p, bygg: [...p.bygg, { id, navn }] }))
    setNyttBygg('')
    setNyttOmradeBygg(id)
  }
  function slettBygg(id: string, navn: string) {
    const n = omraderI(id).length
    if (n && !confirm(`«${navn}» har ${n} område(r). Områdene beholdes, men blir stående uten bygg. Fortsette?`)) return
    onEndre((p) => ({
      ...p,
      bygg: p.bygg.filter((b) => b.id !== id),
      omrader: p.omrader.map((o) => (o.byggId === id ? { ...o, byggId: null } : o)),
    }))
  }
  function leggTilOmrade() {
    const navn = nyttOmrade.trim()
    if (!navn) return
    onEndre((p) => ({ ...p, omrader: [...p.omrader, { id: nyId(), navn, byggId: nyttOmradeBygg || null }] }))
    setNyttOmrade('')
  }
  function slettOmrade(id: string, navn: string) {
    const n = brukOmrade(id)
    if (n && !confirm(`${n} aktivitet(er) ligger i «${navn}». De blir stående uten område. Fortsette?`)) return
    onEndre((p) => ({
      ...p,
      omrader: p.omrader.filter((o) => o.id !== id),
      aktiviteter: p.aktiviteter.map((a) => (a.omradeId === id ? { ...a, omradeId: null } : a)),
    }))
  }
  function leggTilFirma() {
    const navn = nyttFirma.trim()
    if (!navn) return
    onEndre((p) => ({ ...p, firmaer: [...p.firmaer, { id: nyId(), navn, farge: FIRMA_FARGER[p.firmaer.length % FIRMA_FARGER.length] }] }))
    setNyttFirma('')
  }
  function slettFirma(id: string, navn: string) {
    const n = brukFirma(id)
    if (n && !confirm(`${n} aktivitet(er) er tildelt «${navn}». De blir stående uten firma. Fortsette?`)) return
    onEndre((p) => ({
      ...p,
      firmaer: p.firmaer.filter((f) => f.id !== id),
      aktiviteter: p.aktiviteter.map((a) => (a.firmaId === id ? { ...a, firmaId: null } : a)),
    }))
  }

  const Pilknapper = ({ opp, ned, slett }: { opp: () => void; ned: () => void; slett: () => void }) => (
    <>
      <button className="fd-ikonknapp liten" title="Flytt opp" onClick={opp}>
        ↑
      </button>
      <button className="fd-ikonknapp liten" title="Flytt ned" onClick={ned}>
        ↓
      </button>
      <button className="fd-ikonknapp liten" title="Slett" onClick={slett}>
        ✕
      </button>
    </>
  )

  const byggSeksjoner: { id: string | null; navn: string }[] = [
    ...plan.bygg,
    ...(omraderI(null).length ? [{ id: null, navn: 'Uten bygg' }] : []),
  ]

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onLukk()}>
      <div className="modal modal-wide fd-register-modal">
        <h2>Bygg, områder og firmaer</h2>
        <p className="muted small">Rekkefølgen her bestemmer rekkefølgen på gruppene i tidslinjen.</p>
        <div className="two-col">
          <div>
            <h3>Bygg</h3>
            <div className="fd-register">
              {plan.bygg.map((b) => (
                <div key={b.id} className="fd-register-rad">
                  <input
                    value={b.navn}
                    onChange={(e) => onEndre((p) => ({ ...p, bygg: p.bygg.map((x) => (x.id === b.id ? { ...x, navn: e.target.value } : x)) }), 'bygg:' + b.id)}
                  />
                  <span className="muted small">{omraderI(b.id).length} omr.</span>
                  <Pilknapper
                    opp={() => onEndre((p) => ({ ...p, bygg: flytt(p.bygg, b.id, -1) }))}
                    ned={() => onEndre((p) => ({ ...p, bygg: flytt(p.bygg, b.id, 1) }))}
                    slett={() => slettBygg(b.id, b.navn)}
                  />
                </div>
              ))}
              <form
                className="fd-register-rad"
                onSubmit={(e) => {
                  e.preventDefault()
                  leggTilBygg()
                }}
              >
                <input value={nyttBygg} placeholder="Nytt bygg, f.eks. «Bygg C – Bolig»" onChange={(e) => setNyttBygg(e.target.value)} />
                <button className="btn-secondary fd-liten-knapp" type="submit" disabled={!nyttBygg.trim()}>
                  Legg til
                </button>
              </form>
            </div>

            <h3 className="fd-register-overskrift">Områder</h3>
            <div className="fd-register">
              {byggSeksjoner.map((b) => (
                <div key={b.id ?? '__uten'} className="fd-register-gruppe">
                  <div className="fd-register-byggnavn">{b.navn}</div>
                  {omraderI(b.id).length === 0 && <div className="muted small">Ingen områder ennå.</div>}
                  {omraderI(b.id).map((o) => (
                    <div key={o.id} className="fd-register-rad">
                      <input
                        value={o.navn}
                        onChange={(e) =>
                          onEndre((p) => ({ ...p, omrader: p.omrader.map((x) => (x.id === o.id ? { ...x, navn: e.target.value } : x)) }), 'omrade:' + o.id)
                        }
                      />
                      <select
                        className="fd-register-select"
                        title="Flytt området til et annet bygg"
                        value={o.byggId ?? ''}
                        onChange={(e) =>
                          onEndre((p) => ({ ...p, omrader: p.omrader.map((x) => (x.id === o.id ? { ...x, byggId: e.target.value || null } : x)) }))
                        }
                      >
                        <option value="">Uten bygg</option>
                        {plan.bygg.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.navn}
                          </option>
                        ))}
                      </select>
                      <span className="muted small">{brukOmrade(o.id)} akt.</span>
                      <Pilknapper
                        opp={() => onEndre((p) => ({ ...p, omrader: flytt(p.omrader, o.id, -1, (x) => (x.byggId ?? null) === b.id) }))}
                        ned={() => onEndre((p) => ({ ...p, omrader: flytt(p.omrader, o.id, 1, (x) => (x.byggId ?? null) === b.id) }))}
                        slett={() => slettOmrade(o.id, o.navn)}
                      />
                    </div>
                  ))}
                </div>
              ))}
              <form
                className="fd-register-rad"
                onSubmit={(e) => {
                  e.preventDefault()
                  leggTilOmrade()
                }}
              >
                <input value={nyttOmrade} placeholder="Nytt område, f.eks. «Plan 3»" onChange={(e) => setNyttOmrade(e.target.value)} />
                <select className="fd-register-select" value={nyttOmradeBygg} onChange={(e) => setNyttOmradeBygg(e.target.value)} title="Hvilket bygg området hører til">
                  <option value="">Uten bygg</option>
                  {plan.bygg.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.navn}
                    </option>
                  ))}
                </select>
                <button className="btn-secondary fd-liten-knapp" type="submit" disabled={!nyttOmrade.trim()}>
                  Legg til
                </button>
              </form>
            </div>
          </div>

          <div>
            <h3>Firmaer / UE</h3>
            <div className="fd-register">
              {plan.firmaer.map((f) => (
                <div key={f.id} className="fd-register-rad">
                  <input
                    type="color"
                    className="fd-fargevelger"
                    value={f.farge}
                    title="Farge"
                    onChange={(e) =>
                      onEndre((p) => ({ ...p, firmaer: p.firmaer.map((x) => (x.id === f.id ? { ...x, farge: e.target.value } : x)) }), 'firmafarge:' + f.id)
                    }
                  />
                  <input
                    value={f.navn}
                    onChange={(e) =>
                      onEndre((p) => ({ ...p, firmaer: p.firmaer.map((x) => (x.id === f.id ? { ...x, navn: e.target.value } : x)) }), 'firma:' + f.id)
                    }
                  />
                  <span className="muted small">{brukFirma(f.id)} akt.</span>
                  <Pilknapper
                    opp={() => onEndre((p) => ({ ...p, firmaer: flytt(p.firmaer, f.id, -1) }))}
                    ned={() => onEndre((p) => ({ ...p, firmaer: flytt(p.firmaer, f.id, 1) }))}
                    slett={() => slettFirma(f.id, f.navn)}
                  />
                </div>
              ))}
              <form
                className="fd-register-rad"
                onSubmit={(e) => {
                  e.preventDefault()
                  leggTilFirma()
                }}
              >
                <input value={nyttFirma} placeholder="Nytt firma, f.eks. «Elektro AS»" onChange={(e) => setNyttFirma(e.target.value)} />
                <button className="btn-secondary fd-liten-knapp" type="submit" disabled={!nyttFirma.trim()}>
                  Legg til
                </button>
              </form>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={onLukk}>
            Ferdig
          </button>
        </div>
      </div>
    </div>
  )
}
