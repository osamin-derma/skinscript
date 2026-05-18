import { CheckCircle, XCircle } from 'lucide-react'

/**
 * ExplanationPanel — renders the answer/explanation block in the layout
 * used by the source PDF master files:
 *
 *   Question N · ID: <pdf_id> · Source: <source> — Q<pdf_num>
 *   ─────────────────────────────────────
 *   Explanation
 *   ─────────────────────────────────────
 *
 *   Correct answer: (X) <text>.
 *
 *   <narrative explanation>
 *
 *   Incorrect Answers:
 *
 *   A. <rationale>
 *   B. <rationale>
 *   ...
 *
 *   ─────────────────────────────────────
 *   References: Source: <source> — Q<pdf_num>
 *
 * On top we keep a small Correct/Incorrect chip so the student knows their
 * result without searching for it.
 */
export default function ExplanationPanel({ question, answer, darkMode }) {
  const isCorrect = answer?.correct
  const bg = darkMode ? 'bg-gray-800' : 'bg-white'
  const teal = '#2c3e3f'

  const correctLetter = question.correct_answer
  const correctText =
    correctLetter && question.choices?.[correctLetter]
      ? question.choices[correctLetter]
      : (question.correct_text || '')

  const rationales = question.incorrect_rationales || {}
  const rationaleLetters = Object.keys(rationales).sort()

  const headerLine = [
    question.pdf_num != null ? `Question ${question.pdf_num}` : null,
    question.pdf_id ? `ID: ${question.pdf_id}` : null,
    question.source
      ? `Source: ${question.source}${question.pdf_num != null ? ` — Q${question.pdf_num}` : ''}`
      : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="lg:w-2/5 p-6 border-l dark:border-gray-700 overflow-auto">
      <div className={`${bg} rounded-xl shadow-sm border dark:border-gray-700 p-6`}>

        {/* Result chip */}
        {answer?.submitted && (
          <div className={`flex items-center gap-2 mb-5 px-3 py-2 rounded-lg ${
            isCorrect ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
          }`}>
            {isCorrect
              ? <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
              : <XCircle size={20} className="text-red-600 dark:text-red-400" />}
            <span className={`font-semibold text-sm ${
              isCorrect ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
            }`}>
              {isCorrect ? 'Correct' : 'Incorrect'}
            </span>
            {!isCorrect && answer?.selected && question.choices?.[answer.selected] && (
              <span className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
                Your answer:&nbsp;
                <span className="font-medium">
                  ({answer.selected}) {question.choices[answer.selected]}
                </span>
              </span>
            )}
          </div>
        )}

        {/* Small header line — matches the PDF page header */}
        {headerLine && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {headerLine}
          </p>
        )}

        {/* "Explanation" title with rule */}
        <div className="mb-4">
          <h3
            className="text-xl font-bold"
            style={{ color: darkMode ? '#7fb5b5' : teal }}
          >
            Explanation
          </h3>
          <div
            className="mt-1 h-[2px] rounded"
            style={{ backgroundColor: darkMode ? '#3a5556' : teal, opacity: darkMode ? 0.6 : 1 }}
          />
        </div>

        {/* Correct answer line */}
        <p className="text-[15px] leading-relaxed mb-4 text-gray-900 dark:text-gray-100">
          <span className="font-bold">Correct answer:</span>{' '}
          {correctLetter
            ? <>({correctLetter}) {correctText}.</>
            : (correctText ? `${correctText}.` : <span className="italic text-gray-500">not provided in source</span>)
          }
        </p>

        {/* Narrative explanation */}
        {question.explanation && (
          <div className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-line mb-5">
            {question.explanation}
          </div>
        )}

        {/* Incorrect Answers section */}
        {rationaleLetters.length > 0 && (
          <>
            <p className="text-[15px] font-bold mb-3 text-gray-900 dark:text-gray-100">
              Incorrect Answers:
            </p>
            <div className="space-y-3 mb-4">
              {rationaleLetters.map((letter) => (
                <p
                  key={letter}
                  className="text-[15px] leading-relaxed text-gray-800 dark:text-gray-200"
                >
                  <span className="font-bold">{letter}.</span> {rationales[letter]}
                </p>
              ))}
            </div>
          </>
        )}

        {/* References footer */}
        {question.source && (
          <>
            <hr className="my-4 border-gray-200 dark:border-gray-700" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold">References:</span> Source: {question.source}
              {question.pdf_num != null ? ` — Q${question.pdf_num}` : ''}
            </p>
          </>
        )}

        {/* Discrepancy + Bolognia (kept for backward compat with older fields) */}
        {question.discrepancy && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">⚠️ Discrepancy Note</p>
            <p className="text-xs text-red-600 dark:text-red-300">{question.discrepancy}</p>
          </div>
        )}
        {question.bolognia_note && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">📖 Bolognia 5th Ed. Reference</p>
            <p className="text-xs text-blue-600 dark:text-blue-300 whitespace-pre-line leading-relaxed">{question.bolognia_note}</p>
          </div>
        )}
      </div>
    </div>
  )
}
