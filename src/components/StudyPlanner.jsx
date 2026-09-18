import { useMemo } from 'react'
import { CalendarDays, Target, CheckCircle2, AlertTriangle } from 'lucide-react'

/**
 * StudyPlanner — set the exam date; the app computes a daily quota to finish
 * the unused questions in time and shows on-track / behind for today.
 */
export default function StudyPlanner({ settings, onSettings, unusedCount = 0, todayAnswered = 0, darkMode }) {
  const brand = '#2c3e3f'
  const examDate = settings?.examDate || ''
  const plan = useMemo(() => {
    if (!examDate) return null
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const exam = new Date(examDate + 'T00:00:00')
    const daysLeft = Math.round((exam - today) / 86400000)
    if (Number.isNaN(daysLeft)) return null
    const quota = daysLeft > 0 ? Math.ceil(unusedCount / daysLeft) : unusedCount
    return { daysLeft, quota, onTrack: todayAnswered >= quota, remaining: Math.max(0, quota - todayAnswered) }
  }, [examDate, unusedCount, todayAnswered])
  const card = darkMode ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-xl border p-4 ${card}`}>
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays size={16} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <h3 className="font-semibold text-sm">Study planner</h3>
        <input
          type="date" value={examDate} min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onSettings({ examDate: e.target.value || null })}
          className={`ml-auto text-xs px-2 py-1 rounded-lg border outline-none ${darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
          aria-label="Exam date"
        />
      </div>
      {!plan ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Set your exam date and I’ll compute how many questions a day finishes the bank in time.</p>
      ) : plan.daysLeft < 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Your exam date has passed — set the next one.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center mb-2">
            <div><div className="text-lg font-bold tabular-nums">{plan.daysLeft}</div><div className="text-[10px] uppercase tracking-wide text-gray-400">days left</div></div>
            <div><div className="text-lg font-bold tabular-nums">{unusedCount.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-gray-400">unused</div></div>
            <div><div className="text-lg font-bold tabular-nums" style={{ color: darkMode ? '#7fb5b5' : brand }}>{plan.quota}</div><div className="text-[10px] uppercase tracking-wide text-gray-400">per day</div></div>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium ${plan.onTrack ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {plan.onTrack ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {plan.onTrack ? `On track — ${todayAnswered} answered today` : `${plan.remaining} more today to stay on track (${todayAnswered}/${plan.quota})`}
          </div>
          <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, plan.quota ? (todayAnswered / plan.quota) * 100 : 100)}%`, backgroundColor: plan.onTrack ? '#22c55e' : brand }} />
          </div>
        </>
      )}
      <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <Target size={13} /> Daily goal
        <select value={settings?.dailyGoal ?? 30} onChange={(e) => onSettings({ dailyGoal: Number(e.target.value) })} className={`px-1.5 py-0.5 rounded border text-xs ${darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}>
          {[10, 20, 30, 50, 80, 100].map((n) => <option key={n} value={n}>{n} / day</option>)}
        </select>
      </div>
    </div>
  )
}
