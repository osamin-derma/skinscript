import { CheckCircle, XCircle, Lightbulb } from 'lucide-react'

export default function ExplanationPanel({ question, answer, darkMode }) {
  const isCorrect = answer?.correct
  const bg = darkMode ? 'bg-gray-800' : 'bg-white'

  return (
    <div className={`lg:w-2/5 p-6 border-l dark:border-gray-700 overflow-auto`}>
      <div className={`${bg} rounded-xl shadow-sm border dark:border-gray-700 p-5`}>
        {/* Result header */}
        <div className={`flex items-center gap-2 mb-4 p-3 rounded-lg ${isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
          {isCorrect
            ? <CheckCircle size={22} className="text-green-600" />
            : <XCircle size={22} className="text-red-600" />
          }
          <span className={`font-bold ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </span>
        </div>

        {/* Correct answer */}
        <div className="mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Correct Answer</span>
          <p className="mt-1 font-semibold text-green-700 dark:text-green-400">
            {question.correct_answer && question.choices?.[question.correct_answer]
              ? `${question.correct_answer}. ${question.choices[question.correct_answer]}`
              : (question.correct_text || '—')}
          </p>
        </div>

        {/* Your answer (if wrong) */}
        {!isCorrect && answer?.selected && (
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your Answer</span>
            <p className="mt-1 text-red-600 dark:text-red-400 line-through">
              {answer.selected}. {question.choices?.[answer.selected] || ''}
            </p>
          </div>
        )}

        {/* Explanation */}
        {question.explanation && (
          <div className="mt-4 pt-4 border-t dark:border-gray-700">
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb size={16} className="text-amber-500" />
              <span className="text-sm font-bold">Explanation</span>
            </div>
            <div className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 whitespace-pre-line">
              {question.explanation}
            </div>
          </div>
        )}

        {/* Discrepancy note (red flag) */}
        {question.discrepancy && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">⚠️ Discrepancy Note</p>
            <p className="text-xs text-red-600 dark:text-red-300">{question.discrepancy}</p>
          </div>
        )}

        {/* Bolognia reference note */}
        {question.bolognia_note && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">📖 Bolognia 5th Ed. Reference</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 whitespace-pre-line leading-relaxed">{question.bolognia_note}</p>
          </div>
        )}

        {/* Topic tag + Exam source */}
        <div className="mt-4 pt-3 border-t dark:border-gray-700 flex flex-wrap gap-2">
          {question.topic && (
            <span className="inline-block px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#e8f0f0', color: '#2c3e3f' }}>
              📚 {question.topic}
            </span>
          )}
          {question.exam && (
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-500">
              📅 {question.exam}
            </span>
          )}
        </div>

        {/* Source */}
        {question.source && (
          <p className="text-xs text-gray-400 mt-2">Source: {question.source}</p>
        )}
      </div>
    </div>
  )
}
