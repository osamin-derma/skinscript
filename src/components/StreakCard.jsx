import { useMemo, useState } from 'react'
import { Flame, Target } from 'lucide-react'
import { computeStreak, todayAnswered } from '../lib/analytics'

const GOAL_KEY = 'skinscript-daily-goal'
const GOALS = [10, 20, 30, 50]

/**
 * Streak + daily-goal card. Streak/longest are derived from quiz history dates;
 * the daily goal is a device preference (localStorage). Today's progress is the
 * number of questions answered across today's quizzes.
 */
export default function StreakCard({ history, darkMode }) {
  const brand = '#2c3e3f'
  const [goal, setGoal] = useState(() => Number(localStorage.getItem(GOAL_KEY)) || 30)
  const streak = useMemo(() => computeStreak(history), [history])
  const today = useMemo(() => todayAnswered(history), [history])
  const pct = Math.min(100, Math.round((today / Math.max(1, goal)) * 100))
  const met = today >= goal

  const setG = (g) => { setGoal(g); localStorage.setItem(GOAL_KEY, String(g)) }
  const sub = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-xl border p-4 ${sub} mb-6`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Flame size={26} style={{ color: streak.current > 0 ? '#f97316' : '#9ca3af' }} />
          <div>
            <div className="text-2xl font-bold leading-none" style={{ color: darkMode ? '#f3f4f6' : brand }}>{streak.current}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">day streak</div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <Target size={12} /> Today’s goal
            </span>
            <span className="font-medium" style={{ color: met ? '#16a34a' : (darkMode ? '#d1d5db' : '#374151') }}>
              {today} / {goal}{met ? ' ✓' : ''}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: met ? '#22c55e' : brand }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-gray-400">Best {streak.longest} · {streak.studyDays} days studied</span>
        <div className="flex items-center gap-1">
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => setG(g)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                goal === g ? 'text-white border-transparent' : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
              }`}
              style={goal === g ? { backgroundColor: brand } : {}}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
