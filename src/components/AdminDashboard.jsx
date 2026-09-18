import { useEffect, useState } from 'react'
import { Users, Flag, Loader2, CheckCircle2 } from 'lucide-react'
import * as userdata from '../lib/userdata'

/** Owner-only cohort dashboard: activity, scores, weak signals, question reports. */
export default function AdminDashboard({ darkMode, lookupQuestion, onOpenQuestion }) {
  const brand = '#2c3e3f'
  const [rows, setRows] = useState(null)
  const [reports, setReports] = useState([])
  useEffect(() => {
    let alive = true
    Promise.all([userdata.fetchCohortStats(), userdata.fetchReports()]).then(([r, q]) => { if (alive) { setRows(r); setReports(q) } })
    return () => { alive = false }
  }, [])
  const bg = darkMode ? 'bg-gray-800' : 'bg-white'
  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—'
  const stale = (d) => !d || (Date.now() - new Date(d).getTime()) > 14 * 86400000
  return (
    <div className={`${bg} rounded-2xl shadow-xl p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <Users size={18} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <h2 className="font-bold text-lg">Cohort</h2>
        {rows && <span className="ml-auto text-xs text-gray-400">{rows.length} accounts · {rows.filter((r) => !stale(r.last_active)).length} active in 14 days</span>}
      </div>
      {rows === null ? <Loader2 size={18} className="animate-spin text-gray-400" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-400">
              <th className="py-1 pr-2">Student</th><th className="py-1 pr-2">Last active</th><th className="py-1 pr-2 text-right">Quizzes</th><th className="py-1 pr-2 text-right">Avg %</th><th className="py-1 pr-2 text-right">Used</th><th className="py-1 pr-2 text-right">Wrong</th><th className="py-1 pr-2 text-right">7-day Qs</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className={`border-t dark:border-gray-700 ${stale(r.last_active) ? 'text-gray-400' : ''}`}>
                  <td className="py-1.5 pr-2 font-medium">{r.username || r.email || r.phone || '—'}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{fmt(r.last_active)}{stale(r.last_active) && r.quizzes > 0 ? ' · inactive' : ''}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.quizzes}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.avg_score ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{Number(r.used_count).toLocaleString()}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.wrong_count}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{r.answered_7d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center gap-2 mt-6 mb-2">
        <Flag size={16} className="text-orange-500" /><h3 className="font-semibold text-sm">Question reports</h3>
        <span className="ml-auto text-xs text-gray-400">{reports.filter((r) => r.status === 'open').length} open</span>
      </div>
      {reports.length === 0 ? <p className="text-xs text-gray-400">No reports yet.</p> : (
        <div className="space-y-1.5">
          {reports.map((r) => {
            const q = lookupQuestion?.(r.pdf_id)
            return (
              <div key={r.id} className={`rounded-lg border px-3 py-2 text-xs ${darkMode ? 'border-gray-700' : 'border-gray-200'} ${r.status !== 'open' ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.reason}</span><span className="text-gray-400">· {r.pdf_id} · {fmt(r.created_at)}</span>
                  {q && onOpenQuestion && <button onClick={() => onOpenQuestion(q)} className="ml-auto underline text-gray-500">open</button>}
                  {r.status === 'open' && <button onClick={async () => { await userdata.setReportStatus(r.id, 'resolved'); setReports((rs) => rs.map((x) => x.id === r.id ? { ...x, status: 'resolved' } : x)) }} className="flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> resolve</button>}
                </div>
                {q && <p className="mt-1 text-gray-600 dark:text-gray-300 line-clamp-2">{q.question}</p>}
                {r.comment && <p className="mt-1 italic text-gray-500">“{r.comment}”</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
