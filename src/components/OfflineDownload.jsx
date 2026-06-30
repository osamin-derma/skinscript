import { useState, useRef, useEffect } from 'react'
import { Download, Check, WifiOff, Loader2, X as XIcon, AlertCircle, RotateCcw } from 'lucide-react'

/**
 * OfflineDownload — pre-fetches every clinical image so the Atlas and all
 * question photos work fully offline. Each image is loaded via <img> (which
 * the service worker intercepts and caches; opaque/status-0 responses are
 * cacheable per the SW config), so there's no CORS dependency.
 *
 * Correctness guards:
 *  - the run only starts when the service worker is CONTROLLING the page,
 *    otherwise images would load from the network and never be cached;
 *  - only successful loads count, and we VERIFY the SW cache actually grew
 *    before declaring "done" (a failed/opaque load is not proof of caching).
 */
const DONE_KEY = 'skinscript-images-cached'
const CONCURRENCY = 8

async function imageCacheCount() {
  try {
    for (const name of await caches.keys()) {
      if (/question-images/.test(name)) return (await (await caches.open(name)).keys()).length
    }
  } catch { /* ignore */ }
  return 0
}

export default function OfflineDownload({ imageUrls = [], darkMode }) {
  const brand = '#2c3e3f'
  const total = imageUrls.length
  const [phase, setPhase] = useState('idle') // idle | running | done | partial | needsReload | error
  const [done, setDone] = useState(0)
  const abortRef = useRef(false)
  const [alreadyDone, setAlreadyDone] = useState(false)

  useEffect(() => {
    try {
      const rec = JSON.parse(localStorage.getItem(DONE_KEY) || 'null')
      if (rec && rec.count >= Math.floor(total * 0.9) && total > 0) setAlreadyDone(true)
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
    // The SW must control the page, else <img> loads bypass the cache.
    if (!('serviceWorker' in navigator)) { setPhase('error'); return }
    if (!navigator.serviceWorker.controller) {
      try { await navigator.serviceWorker.ready } catch { /* ignore */ }
      if (!navigator.serviceWorker.controller) { setPhase('needsReload'); return }
    }
    const before = await imageCacheCount()
    abortRef.current = false
    setPhase('running')
    setDone(0)
    let attempted = 0, succeeded = 0
    const queue = [...imageUrls]
    const worker = async () => {
      while (queue.length && !abortRef.current) {
        const url = queue.shift()
        const ok = await loadOne(url)
        attempted += 1
        if (ok) succeeded += 1
        setDone(attempted)
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker))
    if (abortRef.current) { setPhase('idle'); return }

    const after = await imageCacheCount()
    const cacheGrew = after > before || after >= total
    if (!cacheGrew) { setPhase('needsReload'); return }   // loaded but not cached → SW not active
    if (succeeded >= Math.floor(total * 0.9)) {
      try { localStorage.setItem(DONE_KEY, JSON.stringify({ count: succeeded, cached: after, at: Date.now() })) } catch { /* ignore */ }
      setAlreadyDone(true)
      setPhase('done')
    } else if (succeeded > 0) {
      setPhase('partial')
    } else {
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
          {phase === 'done' || alreadyDone
            ? <><Check size={16} /> Images saved for offline{phase !== 'running' ? ' · re-download' : ''}</>
            : phase === 'partial'
              ? <><RotateCcw size={16} /> Resume download</>
              : <><Download size={16} /> Download images for offline</>}
        </button>
      )}

      {phase === 'needsReload' && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-start gap-1.5">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          Reload the app once so offline caching activates, then tap again.
        </p>
      )}
      {phase === 'partial' && <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Some images haven’t downloaded yet — tap to finish (already-saved ones are skipped).</p>}
      {phase === 'error' && <p className="text-xs text-red-500 mt-2">Download didn’t work — check your connection and retry.</p>}
    </div>
  )
}
