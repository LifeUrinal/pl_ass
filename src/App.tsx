import { useEffect, useState } from 'react'
import type { ProjectDataSet, RawUploadedFile, RequiredFileKey } from './types'
import { EMPTY_DATASET, clearDataset, loadDataset, saveDataset } from './lib/storage'
import UploadGate from './components/UploadGate'
import Dashboard from './components/Dashboard'

export default function App() {
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
