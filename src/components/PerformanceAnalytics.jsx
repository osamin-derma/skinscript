import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Target, GraduationCap, ArrowRight } from 'lucide-react'
import { computeCategoryStats, computeTrend, rankWeakCategories, computeReadiness } from '../lib/analytics'

const accColor = (a) => (a >= 75 ? '#22c55e' : a >= 55 ? '#f59e0b' : '#ef4444')

/**
 * Phase 1 analytics: board-readiness, score trend, per-category accuracy, and
 * weakest areas with one-tap practice. All derived from saved exam detail.
 */
export default function PerformanceAnalytics({ history, lookupQuestion, darkMode, onPracticeCategory }) {
  const brand = '#2c3e3f'
  const stats = useMemo(() => computeCategoryStats(history, lookupQuestion), [history, lookupQuestion])
  const trend = useMemo(() => computeTrend(history), [history])
  const weak = useMemo(() => rankWeakCategories(stats), [stats])
  const readiness = useMemo(() => computeReadiness(stats, history), [stats, history])

  const sub = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'
  const heading = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2'

  if (stats.length === 0 && trend.points.length < 2) {
    return (
      <div className={`rounded-xl border p-5 text-center ${sub}`}>
        <GraduationCap size={22} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Take a few quizzes to unlock category accuracy, trends, and a readiness read.</p>
      </div>
    )
  }

  const bandText = { 'on-track': 'On track', borderline: 'Borderline', low: 'Needs work' }
  const bandColor = { 'on-track': '#16a34a', borderline: '#d97706', low: '#dc2626' }

  return (
    <div className="space-y-6">
      {/* Readiness */}
      <div className={`rounded-xl border p-4 ${sub}`}>
        <div className={heading}>Board readiness</div>
        {readiness.enoughData ? (
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={darkMode ? '#374151' : '#e5e7eb'} strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={bandColor[readiness.band]} strokeWidth="3"
                  strokeDasharray={`${readiness.pct} ${100 - readiness.pct}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: bandColor[readiness.band] }}>
                {readiness.pct}%
              </div>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: bandColor[readiness.band] }}>{bandText[readiness.band]}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Overall accuracy across {readiness.attempts.toLocaleString()} answered questions.
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Study aid only — not a predicted exam score.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Keep practicing to unlock — needs ≥200 answered questions across ≥5 quizzes
            ({readiness.attempts}/200 so far).
          </p>
        )}
      </div>

      {/* Score trend */}
      {trend.points.length >= 2 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={heading + ' mb-0'}>Score trend</span>
            <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: trend.slope >= 0 ? '#16a34a' : '#dc2626' }}>
              {trend.slope >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {trend.slope >= 0 ? '+' : ''}{trend.slope} pts
            </span>
          </div>
          <TrendChart trend={trend} darkMode={darkMode} />
        </div>
      )}

      {/* Weakest areas */}
      {weak.length > 0 && (
        <div className={`rounded-xl border p-4 ${sub}`}>
          <div className="flex items-center gap-1.5 mb-3">
            <Target size={14} style={{ color: brand }} />
            <span className="text-sm font-semibold">Focus next on</span>
          </div>
          <div className="space-y-2">
            {weak.map((s) => (
              <button
                key={s.category}
                onClick={() => onPracticeCategory?.(s.category)}
                className="w-full flex items-center gap-3 text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition"
              >
                <span className="text-sm font-bold w-11 text-right flex-shrink-0" style={{ color: accColor(s.accuracy) }}>{s.accuracy}%</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{s.category}</div>
                  <div className="text-[10px] text-gray-400">{s.correct}/{s.attempts} correct</div>
                </div>
                <span className="text-[10px] font-medium flex items-center gap-0.5 flex-shrink-0" style={{ color: brand }}>
                  Practice <ArrowRight size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Per-category accuracy */}
      {stats.length > 0 && (
        <div>
          <div className={heading}>Accuracy by category</div>
          <div className="space-y-2.5">
            {stats.map((s) => (
              <div key={s.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="truncate">{s.category}</span>
                  <span className="text-gray-400 flex-shrink-0 ml-2">
                    <span className="font-semibold" style={{ color: accColor(s.accuracy) }}>{s.accuracy}%</span>
                    <span className="ml-1">({s.correct}/{s.attempts})</span>
                  </span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.accuracy}%`, backgroundColor: accColor(s.accuracy) }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">From quizzes taken since per-question review was added.</p>
        </div>
      )}
    </div>
  )
}

// Inline-SVG line chart (no chart lib) — score points + moving average.
function TrendChart({ trend, darkMode }) {
  const W = 320, H = 90, P = 6
  const pts = trend.points
  const n = pts.length
  const x = (i) => P + (i / Math.max(1, n - 1)) * (W - 2 * P)
  const y = (v) => P + (1 - v / 100) * (H - 2 * P)
  const line = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const grid = darkMode ? '#374151' : '#e5e7eb'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
      {[0, 50, 100].map((g) => (
        <line key={g} x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke={grid} strokeWidth="0.5" />
      ))}
      {n >= 5 && <path d={line(trend.movingAvg)} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3 3" />}
      <path d={line(pts.map((p) => p.score))} fill="none" stroke="#2c3e3f" strokeWidth="2" />
      {pts.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.score)} r="2" fill={accColor(p.score)} />
      ))}
    </svg>
  )
}
