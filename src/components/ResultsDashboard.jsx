import { useState } from 'react'
import { Trophy, RotateCcw, Flag, Eye, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function ResultsDashboard({ state, questions, dispatch }) {
  const { questionOrder, answers, flagged, darkMode } = state
  const [expandedQ, setExpandedQ] = useState(null)
  const [filter, setFilter] = useState('all')

  const total = questionOrder.length
  const answeredIds = Object.keys(answers).map(Number)
  const correct = Object.values(answers).filter(a => a.correct).length
  const incorrect = Object.values(answers).filter(a => a.submitted && !a.correct).length
  const unanswered = total - Object.values(answers).filter(a => a.submitted).length
  const score = total > 0 ? Math.round((correct / total) * 100) : 0

  // Topic breakdown
  const topicStats = {}
  questionOrder.forEach(qi => {
    const q = questions[qi]
    if (!q) return
    const topic = q.topic || 'Other'
    if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 }
    topicStats[topic].total++
    if (answers[q.id]?.correct) topicStats[topic].correct++
  })

  const filteredOrder = questionOrder.filter(qi => {
    const q = questions[qi]
    if (!q) return false
    const ans = answers[q.id]
    if (filter === 'correct') return ans?.correct
    if (filter === 'incorrect') return ans?.submitted && !ans.correct
    if (filter === 'unanswered') return !ans?.submitted
    if (filter === 'flagged') return flagged.includes(q.id)
    return true
  })

  const bg = darkMode ? 'bg-gray-800' : 'bg-white'
  const cardBg = darkMode ? 'bg-gray-700' : 'bg-gray-50'

  const getGrade = () => {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-600', emoji: '🏆' }
    if (score >= 75) return { label: 'Good', color: 'text-blue-600', emoji: '👍' }
    if (score >= 60) return { label: 'Satisfactory', color: 'text-yellow-600', emoji: '📝' }
    return { label: 'Needs Review', color: 'text-red-600', emoji: '📖' }
  }
  const grade = getGrade()

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Score Card */}
        <div className={`${bg} rounded-2xl shadow-xl p-8 mb-6 text-center`}>
          <div className="text-5xl mb-3">{grade.emoji}</div>
          <h1 className="text-2xl font-bold mb-1">Quiz Complete!</h1>
          <p className="text-gray-500 mb-6">SkinScript — Dermatology & Education</p>

          <div className="flex items-center justify-center gap-2 mb-4">
            <Trophy className="text-amber-500" size={28} />
            <span className="text-5xl font-bold" style={{ color: '#2c3e3f' }}>{score}%</span>
          </div>

          <p className={`text-lg font-semibold ${grade.color}`}>{grade.label}</p>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
              <div className="text-2xl font-bold text-green-600">{correct}</div>
              <div className="text-xs text-green-600">Correct</div>
            </div>
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
              <div className="text-2xl font-bold text-red-600">{incorrect}</div>
              <div className="text-xs text-red-600">Incorrect</div>
            </div>
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-700">
              <div className="text-2xl font-bold text-gray-500">{unanswered}</div>
              <div className="text-xs text-gray-500">Unanswered</div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => dispatch({ type: 'RESTART' })}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-semibold hover:opacity-90"
              style={{ backgroundColor: '#2c3e3f' }}
            >
              <RotateCcw size={16} /> Restart Quiz
            </button>
            {flagged.length > 0 && (
              <button
                onClick={() => dispatch({ type: 'REVIEW_FLAGGED' })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-orange-300 text-orange-600 font-semibold hover:bg-orange-50"
              >
                <Flag size={16} /> Review Flagged ({flagged.length})
              </button>
            )}
          </div>
        </div>

        {/* Topic breakdown */}
        <div className={`${bg} rounded-xl shadow-sm p-6 mb-6`}>
          <h2 className="font-bold mb-4">Performance by Topic</h2>
          <div className="space-y-2">
            {Object.entries(topicStats).sort((a, b) => b[1].total - a[1].total).map(([topic, s]) => {
              const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0
              return (
                <div key={topic} className="flex items-center gap-3">
                  <span className="text-sm flex-1 truncate">{topic}</span>
                  <span className="text-xs text-gray-400 w-16 text-right">{s.correct}/{s.total}</span>
                  <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: pct >= 70 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Question Review List */}
        <div className={`${bg} rounded-xl shadow-sm p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Question Review</h2>
            <div className="flex gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'correct', label: '✓' },
                { key: 'incorrect', label: '✗' },
                { key: 'flagged', label: '🚩' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${filter === f.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            {filteredOrder.map((qi, idx) => {
              const q = questions[qi]
              if (!q) return null
              const ans = answers[q.id]
              const expanded = expandedQ === q.id

              return (
                <div key={q.id} className={`${cardBg} rounded-lg overflow-hidden`}>
                  <button
                    onClick={() => setExpandedQ(expanded ? null : q.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <span className="flex-shrink-0">
                      {ans?.correct ? <CheckCircle size={16} className="text-green-500" /> :
                       ans?.submitted ? <XCircle size={16} className="text-red-500" /> :
                       <span className="w-4 h-4 rounded-full border-2 border-gray-300 inline-block" />}
                    </span>
                    <span className="text-xs text-gray-400 w-6">{idx + 1}</span>
                    <span className="text-sm flex-1 truncate">{q.question}</span>
                    {flagged.includes(q.id) && <span className="text-xs">🚩</span>}
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4 border-t dark:border-gray-600">
                      <div className="mt-3 text-sm">
                        <p className="font-medium mb-2">{q.question}</p>
                        {Object.entries(q.choices || {}).sort().map(([letter, text]) => (
                          <div key={letter} className={`py-1 px-2 rounded text-xs mb-1 ${
                            letter === q.correct_answer ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            letter === ans?.selected ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300' : ''
                          }`}>
                            <strong>{letter}.</strong> {text}
                            {letter === q.correct_answer && ' ✓'}
                            {letter === ans?.selected && letter !== q.correct_answer && ' ✗'}
                          </div>
                        ))}
                        {q.explanation && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs leading-relaxed whitespace-pre-line">
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6 pb-4">SkinScript — Created by Dr. Osama Al Rawi</p>
      </div>
    </div>
  )
}
