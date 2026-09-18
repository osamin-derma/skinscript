import { RotateCw } from 'lucide-react'

/** Refresh the app: check for a new service-worker build, then reload. */
export default function RefreshButton({ darkMode, label = 'Refresh app', compact = false }) {
  const refresh = async () => {
    try { const r = await navigator.serviceWorker?.getRegistration(); await r?.update() } catch { /* ignore */ }
    window.location.reload()
  }
  if (compact) {
    return (
      <button onClick={refresh} title="Refresh app" aria-label="Refresh app" className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
        <RotateCw size={16} />
      </button>
    )
  }
  return (
    <button onClick={refresh} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
      <RotateCw size={15} /> {label}
    </button>
  )
}
