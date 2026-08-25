import { useState } from 'react'
import type { BudgetSummary as BudgetSummaryType } from '../../lib/calculations'
import { computeBraPris, formatKr, formatPercent } from '../../lib/calculations'

interface Props {
  budget: BudgetSummaryType
  braI?: number
  onBraIChange: (value: number | undefined) => void
}

export default function BudgetSummary({ budget, braI, onBraIChange }: Props) {
  const [input, setInput] = useState(braI ? String(braI) : '')
  const braPris = computeBraPris(budget.budsjettPlussGodkjenteEndringer, budget.sluttkost, braI)

  return (
    <section className="card">
      <h2>Økonomisk oversikt</h2>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Opprinnelig budsjett</div>
          <div className="stat-value">{formatKr(budget.opprinneligBudsjett)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Budsjett + godkjente endringer</div>
          <div className="stat-value">{formatKr(budget.budsjettPlussGodkjenteEndringer)}</div>
          <div className="stat-sub">Godkjente endringer: {formatKr(budget.godkjenteEndringerSum)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Sluttkost (prognose)</div>
          <div className="stat-value">{formatKr(budget.sluttkost)}</div>
          <div className={`stat-sub ${budget.avvikSluttkostMotBudsjett > 0 ? 'negative' : 'positive'}`}>
            {budget.avvikSluttkostMotBudsjett > 0 ? '+' : ''}
            {formatKr(budget.avvikSluttkostMotBudsjett)} mot budsjett
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Dekningsgrad</div>
          <div className={`stat-value ${budget.dekningsgrad < 0 ? 'negative' : ''}`}>{formatPercent(budget.dekningsgrad)}</div>
        </div>
      </div>

      <div className="bra-input-row">
        <label htmlFor="bra-i">BRA-i (m²)</label>
        <input
          id="bra-i"
          type="number"
          min={0}
          placeholder="Skriv inn bruksareal internt"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            const n = parseFloat(e.target.value)
            onBraIChange(isNaN(n) || n <= 0 ? undefined : n)
          }}
        />
        {braPris && (
          <div className="bra-result">
            <span>
              Budsjett/m²: <strong>{formatKr(braPris.budsjettPrKvm)}</strong>
            </span>
            <span>
              Sluttkost/m²: <strong>{formatKr(braPris.sluttkostPrKvm)}</strong>
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
