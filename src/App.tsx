import { useEffect, useState } from 'react'
import type { ProjectDataSet, RawUploadedFile, RequiredFileKey } from './types'
import { EMPTY_DATASET, clearDataset, loadDataset, saveDataset } from './lib/storage'
import UploadGate from './components/UploadGate'
import Dashboard from './components/Dashboard'
import Fremdrift from './fremdrift/Fremdrift'

type Modul = 'okonomi' | 'fremdrift'

function startModul(): Modul {
  try {
    return localStorage.getItem('pl_ass:modul') === 'okonomi' ? 'okonomi' : 'fremdrift'
  } catch {
    return 'fremdrift'
  }
}

export default function App() {
  const [modul, setModul] = useState<Modul>(startModul)

  function byttModul(m: Modul) {
    setModul(m)
    try {
      localStorage.setItem('pl_ass:modul', m)
    } catch {
      /* ignorer */
    }
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <span className="app-merke">pl_ass</span>
        <button className={modul === 'fremdrift' ? 'aktiv' : ''} onClick={() => byttModul('fremdrift')}>
          Fremdriftsplan
        </button>
        <button className={modul === 'okonomi' ? 'aktiv' : ''} onClick={() => byttModul('okonomi')}>
          Prosjektøkonomi
        </button>
      </nav>
      <div className="app-innhold">{modul === 'fremdrift' ? <Fremdrift /> : <Okonomi />}</div>
    </div>
  )
}

function Okonomi() {
  const [dataset, setDataset] = useState<ProjectDataSet | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)

  useEffect(() => {
    loadDataset().then((d) => {
      const loaded = d ?? EMPTY_DATASET
      setDataset(loaded)
      setShowDashboard(Object.keys(loaded.meta).length === 6)
    })
  }, [])

  useEffect(() => {
    if (dataset) saveDataset(dataset)
  }, [dataset])

  if (!dataset) {
    return (
      <div className="loading-screen">
        <p>Laster…</p>
      </div>
    )
  }

  function handleFileImported(key: RequiredFileKey, rows: unknown[], meta: RawUploadedFile) {
    setDataset((d) => {
      if (!d) return d
      return { ...d, [key]: rows, meta: { ...d.meta, [key]: meta } }
    })
  }

  function handleReset() {
    if (!confirm('Dette fjerner alle opplastede filer og tilbakestiller appen. Er du sikker?')) return
    clearDataset()
    setDataset(EMPTY_DATASET)
    setShowDashboard(false)
  }

  function handleBraIChange(value: number | undefined) {
    setDataset((d) => (d ? { ...d, braI: value } : d))
  }

  if (!showDashboard) {
    return <UploadGate dataset={dataset} onFileImported={handleFileImported} onContinue={() => setShowDashboard(true)} />
  }

  return <Dashboard dataset={dataset} onBraIChange={handleBraIChange} onReset={handleReset} />
}
