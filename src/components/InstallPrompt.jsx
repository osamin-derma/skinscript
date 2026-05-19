import { useEffect, useState } from 'react'
import { Download, X, Share, PlusSquare } from 'lucide-react'

/**
 * Soft "install this app" banner shown on first-time mobile visits.
 *
 *   - Chromium / Edge / Samsung Internet on Android emit the
 *     `beforeinstallprompt` event — we capture it and offer a real
 *     "Install app" button that triggers the native install dialog.
 *
 *   - iOS Safari does NOT expose programmatic install. Instead we show
 *     an instructional banner once: "Tap Share → Add to Home Screen".
 *
 *   - Already-installed (running in standalone display mode) → nothing.
 *
 *   - User dismissal is remembered for 30 days in localStorage so we
 *     don't nag.
 */
const DISMISS_KEY = 'skinscript-install-prompt-dismissed-until'
const DISMISS_MS  = 1000 * 60 * 60 * 24 * 30   // 30 days

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true       // iOS Safari home-screen flag
  )
}

function isIos() {
  const ua = window.navigator.userAgent
  // Modern iPad pretends to be Mac, so check both UA and touch points.
  return /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && navigator.maxTouchPoints > 1)
}

function dismissedRecently() {
  const until = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10)
  return until > Date.now()
}


export default function InstallPrompt({ darkMode }) {
  const [deferredEvt, setDeferredEvt] = useState(null)
  const [show, setShow] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return

    // Chromium / Edge / Samsung Internet
    const onBefore = (e) => {
      e.preventDefault()
      setDeferredEvt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', onBefore)

    // iOS — no install event ever fires; show after a short delay.
    if (isIos()) {
      const t = setTimeout(() => setShow(true), 2500)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onBefore) }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBefore)
  }, [])

  if (!show) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS))
    setShow(false)
    setShowIosHelp(false)
  }

  const handleInstall = async () => {
    if (deferredEvt) {
      deferredEvt.prompt()
      const choice = await deferredEvt.userChoice
      if (choice.outcome === 'accepted') {
        setShow(false)
      } else {
        dismiss()
      }
      setDeferredEvt(null)
    } else if (isIos()) {
      setShowIosHelp(true)
    }
  }

  return (
    <>
      {/* Bottom banner */}
      <div className={`fixed inset-x-3 bottom-3 z-40 rounded-2xl shadow-2xl border ${
        darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } md:hidden`}>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden shadow-sm">
            <img src="/icon.png" alt="SkinScript" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight" style={{ color: darkMode ? '#7fb5b5' : '#2c3e3f' }}>
              Install SkinScript
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
              Add to your home screen for full-screen, offline use.
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1.5 transition hover:opacity-90"
            style={{ backgroundColor: '#2c3e3f' }}
          >
            <Download size={13} /> Install
          </button>
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            aria-label="Dismiss"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* iOS instructional modal — shown when user taps Install on Safari */}
      {showIosHelp && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={dismiss}
        >
          <div
            className={`max-w-sm w-full rounded-2xl shadow-2xl p-5 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold" style={{ color: darkMode ? '#7fb5b5' : '#2c3e3f' }}>
                Install on iPhone / iPad
              </h3>
              <button onClick={dismiss} aria-label="Close" className="p-1 -m-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold flex-shrink-0">1</span>
                <span className="flex-1">
                  Tap the <Share size={14} className="inline mx-0.5 -mt-0.5" /> <strong>Share</strong> button in Safari’s toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold flex-shrink-0">2</span>
                <span className="flex-1">
                  Scroll down and tap <PlusSquare size={14} className="inline mx-0.5 -mt-0.5" /> <strong>Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold flex-shrink-0">3</span>
                <span className="flex-1">
                  Tap <strong>Add</strong> — SkinScript will appear on your home screen and open full-screen.
                </span>
              </li>
            </ol>
            <button
              onClick={dismiss}
              className="w-full mt-5 py-2 rounded-xl text-white text-sm font-semibold transition hover:opacity-90"
              style={{ backgroundColor: '#2c3e3f' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
