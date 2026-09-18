import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { pushSupported, iosNeedsInstall, enablePush, disablePush, getPushSubscription } from '../lib/push'

/** Account-drawer switch for daily Web Push study reminders (~6 pm local). */
export default function RemindersToggle({ darkMode }) {
  const brand = '#2c3e3f'
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { let alive = true; getPushSubscription().then((s) => { if (alive) setOn(!!s) }); return () => { alive = false } }, [])
  const sub = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'

  if (!pushSupported()) {
    return (
      <div className={`rounded-xl border p-3 text-xs text-gray-500 dark:text-gray-400 ${sub}`}>
        <span className="font-semibold text-gray-700 dark:text-gray-200">Daily reminders: </span>
        {iosNeedsInstall()
          ? 'install SkinScript to your Home Screen (Share → Add to Home Screen), then turn reminders on here.'
          : 'not supported in this browser.'}
      </div>
    )
  }
  const toggle = async () => {
    if (busy) return
    setBusy(true); setMsg('')
    try {
      if (on) { await disablePush(); setOn(false); setMsg('Reminders off.') }
      else { await enablePush(); setOn(true); setMsg('On — you’ll get a nudge around 6 pm when reviews are due or your streak is at risk.') }
    } catch (e) {
      const m = String(e?.message || '')
      setMsg(m === 'denied' ? 'Notifications are blocked for this site — allow them in your browser settings.'
        : m === 'no_sw' ? 'Reminders need the installed app — reload once, or open SkinScript from your home screen.'
        : 'Could not update reminders right now.')
    } finally { setBusy(false) }
  }
  return (
    <div className={`rounded-xl border p-3 ${sub}`}>
      <div className="flex items-center gap-2">
        {on ? <Bell size={15} style={{ color: brand }} /> : <BellOff size={15} className="text-gray-400" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">Daily study reminders</div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Reviews due · streak at risk · ~6 pm your time</div>
        </div>
        <button onClick={toggle} disabled={busy} aria-pressed={on} className={`relative w-11 h-6 rounded-full transition-colors ${on ? '' : 'bg-gray-300 dark:bg-gray-600'}`} style={on ? { backgroundColor: brand } : undefined} aria-label="Toggle daily reminders">
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`}>{busy && <Loader2 size={12} className="animate-spin m-1 text-gray-500" />}</span>
        </button>
      </div>
      {msg && <p className="text-[11px] mt-2 text-gray-500 dark:text-gray-400">{msg}</p>}
    </div>
  )
}
