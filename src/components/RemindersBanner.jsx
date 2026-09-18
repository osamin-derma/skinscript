import { useEffect, useState } from 'react'
import { BellRing, Flame, Bell } from 'lucide-react'

/** In-app reminders: due reviews + streak at risk; optional browser notification when the app opens. */
export default function RemindersBanner({ dueCount = 0, streakCurrent = 0, todayAnswered = 0, onStartDue, darkMode }) {
  const brand = '#2c3e3f'
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported')
  const streakAtRisk = streakCurrent > 0 && todayAnswered === 0
  useEffect(() => {
    if (perm !== 'granted' || dueCount === 0) return
    const key = 'skinscript-notified-' + new Date().toISOString().slice(0, 10)
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      new Notification('SkinScript', { body: `${dueCount} review${dueCount === 1 ? '' : 's'} due today${streakAtRisk ? ` · keep your ${streakCurrent}-day streak` : ''}` })
    } catch { /* ignore */ }
  }, [perm, dueCount, streakAtRisk, streakCurrent])
  if (dueCount === 0 && !streakAtRisk) return null
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-4 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      {streakAtRisk ? <Flame size={18} className="text-orange-500" /> : <BellRing size={18} style={{ color: darkMode ? '#7fb5b5' : brand }} />}
      <div className="flex-1 min-w-0 text-sm">
        {dueCount > 0 && <span className="font-medium">{dueCount} review{dueCount === 1 ? '' : 's'} due today</span>}
        {dueCount > 0 && streakAtRisk && <span className="text-gray-400"> · </span>}
        {streakAtRisk && <span className="text-orange-600 dark:text-orange-400">Answer 1 question to keep your {streakCurrent}-day streak</span>}
      </div>
      {dueCount > 0 && onStartDue && <button onClick={onStartDue} className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: brand }}>Review now</button>}
      {perm === 'default' && <button onClick={() => Notification.requestPermission().then(setPerm)} title="Enable reminders" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600"><Bell size={15} /></button>}
    </div>
  )
}
