import { useState } from 'react'
import type { Fremdriftsplan } from './types'
import { FIRMA_FARGER, nyId } from './logikk'

interface Props {
  plan: Fremdriftsplan
  onEndre: (fn: (p: Fremdriftsplan) => Fremdriftsplan, samleNokkel?: string) => void
  onLukk: () => void
}

/** Vedlikehold av områder og firmaer (UE-er). */
export default function RegisterModal({ plan, onEndre, onLukk }: Props) {
  const [nyttOmrade, setNyttOmrade] = useState('')
  const [nyttFirma, setNyttFirma] = useState('')

  const brukOmrade = (id: string) => plan.aktiviteter.filter((a) => a.omradeId === id).length
  const brukFirma = (id: string) => plan.aktiviteter.filter((a) => a.firmaId === id).length

  function leggTilOmrade() {
    const navn = nyttOmrade.trim()
    if (!navn) return
    onEndre((p) => ({ ...p, omrader: [...p.omrader, { id: nyId(), navn }] }))
    setNyttOmrade('')
  }
  function leggTilFirma() {
    const navn = nyttFirma.trim()
    if (!navn) return
    onEndre((p) => ({ ...p, firmaer: [...p.firmaer, { id: nyId(), navn, farge: FIRMA_FARGER[p.firmaer.length % FIRMA_FARGER.length] }] }))
    setNyttFirma('')
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
  function slettFirma(id: string, navn: string) {
    const n = brukFirma(id)
    if (n && !confirm(`${n} aktivitet(er) er tildelt «${navn}». De blir stående uten firma. Fortsette?`)) return
    onEndre((p) => ({
      ...p,
      firmaer: p.firmaer.filter((f) => f.id !== id),
      aktiviteter: p.aktiviteter.map((a) => (a.firmaId === id ? { ...a, firmaId: null } : a)),
    }))
  }
  function flytt<T>(liste: T[], i: number, retning: -1 | 1): T[] {
    const j = i + retning
    if (j < 0 || j >= liste.length) return liste
    const ny = [...liste]
    ;[ny[i], ny[j]] = [ny[j], ny[i]]
    return ny
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onLukk()}>
      <div className="modal modal-wide">
        <h2>Områder og firmaer</h2>
        <p className="muted small">Rekkefølgen her bestemmer rekkefølgen på gruppene i tidslinjen.</p>
        <div className="two-col">
          <div>
            <h3>Områder</h3>
            <div className="fd-register">
              {plan.omrader.map((o, i) => (
                <div key={o.id} className="fd-register-rad">
                  <input
                    value={o.navn}
                    onChange={(e) =>
                      onEndre((p) => ({ ...p, omrader: p.omrader.map((x) => (x.id === o.id ? { ...x, navn: e.target.value } : x)) }), 'omrade:' + o.id)
                    }
                  />
                  <span className="muted small">{brukOmrade(o.id)} akt.</span>
                  <button className="fd-ikonknapp liten" title="Flytt opp" onClick={() => onEndre((p) => ({ ...p, omrader: flytt(p.omrader, i, -1) }))}>
                    ↑
                  </button>
                  <button className="fd-ikonknapp liten" title="Flytt ned" onClick={() => onEndre((p) => ({ ...p, omrader: flytt(p.omrader, i, 1) }))}>
                    ↓
                  </button>
                  <button className="fd-ikonknapp liten" title="Slett" onClick={() => slettOmrade(o.id, o.navn)}>
                    ✕
                  </button>
                </div>
              ))}
              <form
                className="fd-register-rad"
                onSubmit={(e) => {
                  e.preventDefault()
                  leggTilOmrade()
                }}
              >
                <input value={nyttOmrade} placeholder="Nytt område, f.eks. «Bygg B – Plan 3»" onChange={(e) => setNyttOmrade(e.target.value)} />
                <button className="btn-secondary fd-liten-knapp" type="submit" disabled={!nyttOmrade.trim()}>
                  Legg til
                </button>
              </form>
            </div>
          </div>
          <div>
            <h3>Firmaer / UE</h3>
            <div className="fd-register">
              {plan.firmaer.map((f, i) => (
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
                  <button className="fd-ikonknapp liten" title="Flytt opp" onClick={() => onEndre((p) => ({ ...p, firmaer: flytt(p.firmaer, i, -1) }))}>
                    ↑
                  </button>
                  <button className="fd-ikonknapp liten" title="Flytt ned" onClick={() => onEndre((p) => ({ ...p, firmaer: flytt(p.firmaer, i, 1) }))}>
                    ↓
                  </button>
                  <button className="fd-ikonknapp liten" title="Slett" onClick={() => slettFirma(f.id, f.navn)}>
                    ✕
                  </button>
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
