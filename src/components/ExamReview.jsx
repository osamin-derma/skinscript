import { useState } from 'react'
import { ChevronLeft, CheckCircle, XCircle, MinusCircle, ChevronDown, ChevronUp } from 'lucide-react'
import QuestionImages from './QuestionImages'

/**
 * Read-only review of a past exam. Given the saved `exam.detail`
 * ([{ pdf_id, selected }] in exam order) and a `lookupQuestion(pdf_id)`
 * resolver into the live bank, it re-renders every question with the user's
 * pick, the correct answer, the explanation, and any images — without having
 * to store the full question text in history.
 */
export default function ExamReview({ exam, lookupQuestion, darkMode, onBack }) {
  const [expanded, setExpanded] = useState(null)
  const brand = '#2c3e3f'
  const card = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'

  const items = (exam?.detail || [])
    .map((d) => ({ ...d, q: lookupQuestion(d.pdf_id) }))
    .filter((it) => it.q)

  const correctCount = items.filter((it) => it.selected === it.q.correct_answer).length
  const when = exam?.date ? new Date(exam.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Back to account">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h3 className="text-sm font-bold" style={{ color: darkMode ? '#7fb5b5' : brand }}>Exam review</h3>
          <p className="text-[11px] text-gray-400">{when}</p>
        </div>
        <span
          className="ml-auto text-sm font-bold"
          style={{ color: exam.score >= 70 ? '#16a34a' : exam.score >= 50 ? '#d97706' : '#dc2626' }}
        >
          {exam.score}%
        </span>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">
        {correctCount}/{items.length} correct · <span className="capitalize">{exam.source}</span> · <span className="capitalize">{exam.mode}</span> mode
      </p>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">This exam has no saved question detail to review.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it, idx) => {
            const q = it.q
            const isCorrect = it.selected === q.correct_answer
            const open = expanded === idx
            return (
              <div key={`${it.pdf_id}-${idx}`} className={`rounded-lg border overflow-hidden ${card}`}>
                <button
                  onClick={() => setExpanded(open ? null : idx)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50"
                >
                  <span className="flex-shrink-0">
                    {it.selected == null ? <MinusCircle size={16} className="text-gray-400" />
                      : isCorrect ? <CheckCircle size={16} className="text-green-500" />
                      : <XCircle size={16} className="text-red-500" />}
                  </span>
                  <span className="text-[11px] text-gray-400 w-5">{idx + 1}</span>
                  <span className="text-xs flex-1 truncate">{q.question}</span>
                  {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                </button>

                {open && (
                  <div className="px-3.5 pb-3.5 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium mt-3 mb-2 whitespace-pre-line">{q.question}</p>
                    {q.images?.length > 0 && <QuestionImages images={q.images} darkMode={darkMode} compact mediaMissing={q.media_missing} />}
                    <div className="space-y-1">
                      {Object.entries(q.choices || {}).sort().map(([letter, text]) => {
                        const isAns = letter === q.correct_answer
                        const isPick = letter === it.selected
                        return (
                          <div
                            key={letter}
                            className={`py-1.5 px-2 rounded text-xs ${
                              isAns ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : isPick ? 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : 'text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            <strong>{letter}.</strong> {text}
                            {isAns && ' ✓'}
                            {isPick && !isAns && ' ✗ (your answer)'}
                          </div>
                        )
                      })}
                    </div>
                    {it.selected == null && <p className="text-[11px] text-gray-400 mt-1.5">You did not answer this question.</p>}
                    {q.explanation && (
                      <div className="mt-3 p-3 rounded-lg text-xs leading-relaxed whitespace-pre-line bg-blue-50 dark:bg-blue-900/20 text-gray-700 dark:text-gray-200">
                        {q.explanation}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
