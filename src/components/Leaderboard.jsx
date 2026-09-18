import { useEffect, useState } from 'react'
import { Trophy, Loader2 } from 'lucide-react'
import * as userdata from '../lib/userdata'

/** Opt-in weekly leaderboard: questions answered in the last 7 days. */
export default function Leaderboard({ settings, onSettings, darkMode }) {
  const brand = '#2c3e3f'
  const optIn = !!settings?.leaderboardOptIn
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!optIn) { setRows(null); return }
    let alive = true
    userdata.fetchLeaderboard().then((r) => { if (alive) setRows(r) })
    return () => { alive = false }
  }, [optIn])
  const card = darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
  return (
    <div className={`rounded-xl border p-4 ${card}`}>
      <div className="flex items-center gap-2 mb-2">
        <Trophy size={16} style={{ color: darkMode ? '#d4b966' : '#c9a84c' }} />
        <h3 className="font-semibold text-sm">Weekly leaderboard</h3>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={optIn} onChange={(e) => onSettings({ leaderboardOptIn: e.target.checked })} /> Join
        </label>
      </div>
      {!optIn ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Opt in to see how your week compares with classmates. Only your display name and question counts are shared.</p>
      ) : (
        <>
          <input value={settings?.displayName || ''} onChange={(e) => onSettings({ displayName: e.target.value })} placeholder="Display name (optional)" className={`w-full mb-2 px-2 py-1 rounded-lg border text-xs outline-none ${darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`} />
          {rows === null ? <Loader2 size={16} className="animate-spin text-gray-400" /> : rows.length === 0 ? (
            <p className="text-xs text-gray-400">No one has answered questions this week yet.</p>
          ) : (
            <ol className="space-y-1">
              {rows.map((r, i) => (
                <li key={i} className={`flex items-center gap-2 text-sm px-2 py-1 rounded-lg ${r.is_me ? (darkMode ? 'bg-gray-800' : 'bg-white shadow-sm') : ''}`}>
                  <span className="w-5 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                  <span className={`flex-1 truncate ${r.is_me ? 'font-semibold' : ''}`} style={r.is_me ? { color: darkMode ? '#7fb5b5' : brand } : undefined}>{r.username}{r.is_me ? ' (you)' : ''}</span>
                  <span className="tabular-nums text-xs text-gray-500 dark:text-gray-400">{Number(r.answered_7d).toLocaleString()} Qs</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}
