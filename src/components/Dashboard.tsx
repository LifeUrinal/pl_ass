import type { ProjectDataSet } from '../types'
import { runFullAnalysis } from '../lib/calculations'
import SCurveChart from './charts/SCurveChart'
import BudgetSummary from './widgets/BudgetSummary'
import ProdkodeReconciliation from './widgets/ProdkodeReconciliation'
import ChangeLogSummary from './widgets/ChangeLogSummary'
import SupplierRanking from './widgets/SupplierRanking'
import PlanTimelines from './widgets/PlanTimelines'

interface Props {
  dataset: ProjectDataSet
  onBraIChange: (value: number | undefined) => void
  onReset: () => void
}

export default function Dashboard({ dataset, onBraIChange, onReset }: Props) {
  const analysis = runFullAnalysis(dataset)
  const { faktureringsplan } = analysis

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Prosjektøkonomi</h1>
          <p className="muted">
            {faktureringsplan.startManed && faktureringsplan.sluttManed
              ? `Prosjektperiode: ${faktureringsplan.startManed} – ${faktureringsplan.sluttManed} (${faktureringsplan.varighetMåneder} mnd)`
              : 'Ingen faktureringsplan funnet'}
          </p>
        </div>
        <button className="btn-secondary" onClick={onReset}>
          Last opp nye filer
        </button>
      </header>

      <BudgetSummary budget={analysis.budget} braI={dataset.braI} onBraIChange={onBraIChange} />

      <section className="card">
        <h2>Produksjon vs. fakturering (S-kurve)</h2>
        <SCurveChart data={analysis.sCurve} />
        <div className="muted small">
          Blå linje = fakturaplan (kumulativt planlagt). Oransje linje = faktisk fakturert (kumulativt, fra
          fakturautskrift). Grønt punkt = produsert verdi hittil (fra Prosjektinfo).
        </div>
      </section>

      <ProdkodeReconciliation prodkoder={analysis.prodkoder} />

      <div className="two-col">
        <ChangeLogSummary endringer={analysis.endringer} />
        <SupplierRanking leverandorer={analysis.leverandorer} />
      </div>

      <PlanTimelines
        beslutningsplan={dataset.beslutningsplan}
        innkjopsplan={dataset.innkjopsplan}
        konflikter={analysis.innkjopKonflikter}
      />
    </div>
  )
}
