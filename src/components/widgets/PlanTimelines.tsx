import type { BeslutningRad, InnkjopRad } from '../../types'
import type { InnkjopBeslutningKonflikt } from '../../lib/calculations'
import { formatKr } from '../../lib/calculations'

interface Props {
  beslutningsplan: BeslutningRad[]
  innkjopsplan: InnkjopRad[]
  konflikter: InnkjopBeslutningKonflikt[]
}

export default function PlanTimelines({ beslutningsplan, innkjopsplan, konflikter }: Props) {
  const beslutninger = [...beslutningsplan].sort((a, b) => a.fristDato.localeCompare(b.fristDato))
  const innkjop = [...innkjopsplan].sort((a, b) => a.planlagtInnkjopsdato.localeCompare(b.planlagtInnkjopsdato))
  const konfliktInnkjopIds = new Set(konflikter.map((k) => k.innkjop.id))

  return (
    <section className="card">
      <h2>Beslutnings- og innkjøpsplan</h2>
      {konflikter.length > 0 && (
        <div className="warning-box">
          <strong>{konflikter.length} mulig(e) konflikt(er):</strong> innkjøp planlagt før tilhørende avklaring har frist.
          <ul>
            {konflikter.map((k, i) => (
              <li key={i}>{k.melding}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="two-col">
        <div>
          <h3>Beslutningsplan</h3>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Frist</th>
                  <th>Tema</th>
                  <th>Henvisning/kommentar</th>
                  <th>Prodkode</th>
                  <th>Ansvarlig</th>
                </tr>
              </thead>
              <tbody>
                {beslutninger.map((b) => (
                  <tr key={b.id}>
                    <td>{b.fristDato || '–'}</td>
                    <td>{b.tema}</td>
                    <td>{b.henvisning ?? '–'}</td>
                    <td>{b.knyttetProdkode ?? '–'}</td>
                    <td>{b.ansvarlig ?? '–'}</td>
                  </tr>
                ))}
                {beslutninger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Ingen avklaringer registrert.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3>Innkjøpsplan</h3>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Innkjøpsdato</th>
                  <th>Entreprise</th>
                  <th>Prodkode</th>
                  <th>Budsjett</th>
                </tr>
              </thead>
              <tbody>
                {innkjop.map((k) => (
                  <tr key={k.id} className={konfliktInnkjopIds.has(k.id) ? 'flagged-row' : ''}>
                    <td>{k.planlagtInnkjopsdato}</td>
                    <td>{k.entreprise}</td>
                    <td>{k.prodkode ?? '–'}</td>
                    <td>{k.budsjett ? formatKr(k.budsjett) : '–'}</td>
                  </tr>
                ))}
                {innkjop.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Ingen innkjøp registrert.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
