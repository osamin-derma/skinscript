import { useState, useRef, useEffect } from 'react'
import { Download, Check, WifiOff, Loader2, X as XIcon } from 'lucide-react'

/**
 * OfflineDownload — pre-fetches every clinical image so the Atlas and all
 * question photos work fully offline. Each image is loaded via <img> (which
 * the service worker intercepts and caches; opaque/status-0 responses are
 * cacheable per the SW config), so there's no CORS dependency. Concurrency is
 * pooled and the run is abortable; progress + a "done" flag persist in
 * localStorage.
 */
const DONE_KEY = 'skinscript-images-cached'
const CONCURRENCY = 8

export default function OfflineDownload({ imageUrls = [], darkMode }) {
  const brand = '#2c3e3f'
  const total = imageUrls.length
  const [phase, setPhase] = useState('idle') // idle | running | done | error
  const [done, setDone] = useState(0)
  const abortRef = useRef(false)
  const [alreadyDone, setAlreadyDone] = useState(false)

  useEffect(() => {
    try {
      const rec = JSON.parse(localStorage.getItem(DONE_KEY) || 'null')
      if (rec && rec.count >= total && total > 0) setAlreadyDone(true)
    } catch { /* ignore */ }
  }, [total])

  const loadOne = (url) => new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)   // a missing image shouldn't stall the run
    img.src = url
  })

  const run = async () => {
    if (total === 0) return
    abortRef.current = false
    setPhase('running')
    setDone(0)
    let completed = 0
    const queue = [...imageUrls]
    const worker = async () => {
      while (queue.length && !abortRef.current) {
        const url = queue.shift()
        await loadOne(url)
        completed += 1
        setDone(completed)
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker))
      if (abortRef.current) { setPhase('idle'); return }
      try { localStorage.setItem(DONE_KEY, JSON.stringify({ count: completed, at: Date.now() })) } catch { /* ignore */ }
      setAlreadyDone(true)
      setPhase('done')
    } catch {
      setPhase('error')
    }
  }

  const pct = total ? Math.round((done / total) * 100) : 0
  const card = darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-xl border p-4 ${card}`}>
      <div className="flex items-center gap-2 mb-1">
        <WifiOff size={16} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <h3 className="font-semibold text-sm">Offline access</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
        Questions already work offline once the app is installed. Download the{' '}
        <strong>{total.toLocaleString()}</strong> clinical images too so the Atlas and
        every photo work with no connection. This is a large one-time download — use Wi-Fi.
      </p>

      {phase === 'running' ? (
        <div>
          <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: brand }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Loader2 size={12} className="animate-spin" /> {done.toLocaleString()} / {total.toLocaleString()} ({pct}%)
            </span>
            <button onClick={() => { abortRef.current = true }} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <XIcon size={12} /> Stop
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={run}
          disabled={total === 0}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold ${
            phase === 'done' || alreadyDone
              ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/25 border border-green-200 dark:border-green-800'
              : 'text-white'
          }`}
          style={!(phase === 'done' || alreadyDone) ? { backgroundColor: brand } : undefined}
        >
          {phase === 'done' || alreadyDone ? <><Check size={16} /> Images downloaded {phase === 'idle' ? '· re-download' : ''}</> : <><Download size={16} /> Download images for offline</>}
        </button>
      )}
      {phase === 'error' && <p className="text-xs text-red-500 mt-2">Download interrupted — tap to retry.</p>}
    </div>
  )
}
