import { useState, useEffect, useCallback, useRef } from 'react'
import { Sun, Moon, Flag, Pause, Play, ChevronLeft, ChevronRight, X, Highlighter, Eraser } from 'lucide-react'
import ExplanationPanel from './ExplanationPanel'
import QuestionImages from './QuestionImages'

const HIGHLIGHTS_KEY = 'last11-quiz-highlights'

function loadHighlights() {
  try { return JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY)) || {} }
  catch { return {} }
}
function saveHighlights(h) { localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(h)) }

export default function QuizScreen({ state, questions, dispatch }) {
  const { questionOrder, currentIndex, answers, flagged, mode, timerSetting, darkMode } = state
  const qIdx = questionOrder[currentIndex]
  const q = questions[qIdx]
  const totalQ = questionOrder.length

  const [selected, setSelected] = useState(null)
  const [timeLeft, setTimeLeft] = useState(timerSetting)
  const [paused, setPaused] = useState(false)
  const [showNav, setShowNav] = useState(false)

  // Highlighter state
  const [highlightMode, setHighlightMode] = useState(false)
  const [allHighlights, setAllHighlights] = useState(loadHighlights())
  const stemRef = useRef(null)

  const answered = answers[q?.id]
  const isSubmitted = answered?.submitted

  // Persist highlights
  useEffect(() => { saveHighlights(allHighlights) }, [allHighlights])

  // Get highlights for current question (array of {start, end})
  const qHighlights = (q?.id && allHighlights[q.id]) || []

  // Apply highlight on selection
  const handleHighlight = useCallback(() => {
    if (!highlightMode || !q?.id) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    if (!stemRef.current || !stemRef.current.contains(range.commonAncestorContainer)) return

    // Compute character offsets within the question text
    const fullText = q.question || ''
    const selectedText = sel.toString()
    if (!selectedText.trim()) return
    const start = fullText.indexOf(selectedText)
    if (start < 0) return
    const end = start + selectedText.length

    setAllHighlights(prev => {
      const cur = prev[q.id] || []
      // Merge overlapping ranges
      const merged = [...cur, { start, end }].sort((a, b) => a.start - b.start)
      const out = []
      for (const r of merged) {
        if (out.length && r.start <= out[out.length - 1].end) {
          out[out.length - 1].end = Math.max(out[out.length - 1].end, r.end)
        } else out.push({ ...r })
      }
      return { ...prev, [q.id]: out }
    })
    sel.removeAllRanges()
  }, [highlightMode, q?.id, q?.question])

  // Render question stem with highlights applied
  const renderHighlightedStem = (text) => {
    if (!qHighlights.length) return text
    const parts = []
    let cursor = 0
    for (const { start, end } of qHighlights) {
      if (start > cursor) parts.push(<span key={`p${cursor}`}>{text.slice(cursor, start)}</span>)
      parts.push(
        <mark
          key={`h${start}`}
          className="rounded px-0.5"
          style={{ backgroundColor: '#fef08a', color: 'inherit' }}
        >{text.slice(start, end)}</mark>
      )
      cursor = end
    }
    if (cursor < text.length) parts.push(<span key={`p${cursor}-end`}>{text.slice(cursor)}</span>)
    return parts
  }

  const clearHighlights = () => {
    if (!q?.id) return
    setAllHighlights(prev => {
      const next = { ...prev }
      delete next[q.id]
      return next
    })
  }

  // Reset selection when navigating
  useEffect(() => {
    setSelected(answered?.selected || null)
    setTimeLeft(timerSetting)
  }, [currentIndex, q?.id])

  // Timer for timed mode
  useEffect(() => {
    if (mode !== 'timed' || isSubmitted || paused) return
    if (timeLeft <= 0) {
      handleSubmit()
      return
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, mode, isSubmitted, paused])

  const handleSubmit = useCallback(() => {
    if (!selected && !isSubmitted) return
    const isCorrect = selected === q.correct_answer
    dispatch({ type: 'ANSWER', questionId: q.id, selected, correct: isCorrect })
  }, [selected, q, dispatch])

  const handleNext = () => {
    if (currentIndex < totalQ - 1) dispatch({ type: 'NEXT' })
    else dispatch({ type: 'END_QUIZ' })
  }

  const handleSkip = () => {
    if (currentIndex < totalQ - 1) dispatch({ type: 'NEXT' })
  }

  if (!q) return null

  const progress = ((currentIndex + 1) / totalQ) * 100
  const isFlagged = flagged.includes(q.id)
  const choiceKeys = Object.keys(q.choices || {}).sort()

  const getChoiceStyle = (letter) => {
    if (!isSubmitted) {
      if (selected === letter) return 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-300'
      return 'border-gray-200 dark:border-gray-600 hover:bg-blue-50/50 dark:hover:bg-gray-700'
    }
    if (letter === q.correct_answer) return 'border-green-500 bg-green-50 dark:bg-green-900/30'
    if (letter === answered?.selected && letter !== q.correct_answer) return 'border-red-500 bg-red-50 dark:bg-red-900/30'
    return 'border-gray-200 dark:border-gray-600 opacity-60'
  }

  const getChoiceIcon = (letter) => {
    if (!isSubmitted) return null
    if (letter === q.correct_answer) return <span className="text-green-600 font-bold">✓</span>
    if (letter === answered?.selected && letter !== q.correct_answer) return <span className="text-red-600 font-bold">✗</span>
    return null
  }

  const bg = darkMode ? 'bg-gray-800' : 'bg-white'
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className={`${bg} border-b dark:border-gray-700 px-4 py-2 sticky top-0 z-10`}>
        {/* Progress bar */}
        <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mb-2">
          <div className="h-1 rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: '#2c3e3f' }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">
            Question {currentIndex + 1} of {totalQ}
          </span>

          <div className="flex items-center gap-2">
            {mode === 'timed' && !isSubmitted && (
              <div className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-mono font-bold ${timeLeft <= 10 ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300'}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </div>
            )}

            {mode === 'timed' && !isSubmitted && (
              <button onClick={() => setPaused(!paused)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                {paused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            )}

            {/* Highlighter toggle */}
            <button
              onClick={() => setHighlightMode(prev => !prev)}
              title={highlightMode ? 'Highlighter ON — select text in the question to highlight it' : 'Enable highlighter'}
              className={`p-1.5 rounded-lg transition ${highlightMode ? 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Highlighter size={16} />
            </button>
            {qHighlights.length > 0 && (
              <button
                onClick={clearHighlights}
                title="Clear highlights on this question"
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <Eraser size={16} />
              </button>
            )}

            <button
              onClick={() => dispatch({ type: 'FLAG', questionId: q.id })}
              className={`p-1.5 rounded-lg transition ${isFlagged ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <Flag size={16} fill={isFlagged ? 'currentColor' : 'none'} />
            </button>

            <button onClick={() => dispatch({ type: 'TOGGLE_DARK' })} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              onClick={() => setShowNav(!showNav)}
              className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Navigator
            </button>

            <button
              onClick={() => dispatch({ type: 'END_QUIZ' })}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30"
            >
              End Quiz
            </button>
          </div>
        </div>
      </header>

      {/* Navigator overlay */}
      {showNav && (
        <div className="fixed inset-0 bg-black/30 z-20 flex items-center justify-center p-4" onClick={() => setShowNav(false)}>
          <div className={`${cardBg} rounded-xl shadow-2xl p-6 max-w-xl w-full max-h-[70vh] overflow-auto`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Question Navigator</h3>
              <button onClick={() => setShowNav(false)}><X size={20} /></button>
            </div>
            <div className="grid grid-cols-10 gap-1.5">
              {questionOrder.map((qi, i) => {
                const qItem = questions[qi]
                const ans = answers[qItem?.id]
                const fl = flagged.includes(qItem?.id)
                let bg = 'bg-gray-100 dark:bg-gray-700'
                if (ans?.submitted) bg = ans.correct ? 'bg-green-100 text-green-800 dark:bg-green-900/50' : 'bg-red-100 text-red-800 dark:bg-red-900/50'
                if (i === currentIndex) bg += ' ring-2 ring-blue-500'

                return (
                  <button
                    key={i}
                    onClick={() => { dispatch({ type: 'NAVIGATE', index: i }); setShowNav(false) }}
                    className={`${bg} relative w-8 h-8 rounded text-xs font-medium flex items-center justify-center hover:opacity-80`}
                  >
                    {i + 1}
                    {fl && <span className="absolute -top-0.5 -right-0.5 text-orange-500 text-[8px]">🚩</span>}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border" /> Unanswered</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100" /> Correct</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100" /> Incorrect</span>
              <span className="flex items-center gap-1">🚩 Flagged</span>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        {/* Left: Question */}
        <div className={`flex-1 ${isSubmitted && (mode === 'tutor' || mode === 'review') ? 'lg:w-3/5' : 'lg:w-full'} p-6`}>
          <div className={`${cardBg} rounded-xl shadow-sm border dark:border-gray-700 p-6`}>
            {/* Topic tag */}
            {q.topic && (
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium mb-3" style={{ backgroundColor: '#e8f0f0', color: '#2c3e3f' }}>
                {q.topic}
              </span>
            )}

            {/* Question stem (with highlighter support) */}
            <p
              ref={stemRef}
              onMouseUp={handleHighlight}
              onTouchEnd={handleHighlight}
              className={`text-base leading-relaxed mb-6 font-medium text-gray-900 dark:text-gray-100 ${highlightMode ? 'cursor-text' : ''}`}
              style={highlightMode ? { backgroundColor: 'rgba(254, 240, 138, 0.06)' } : {}}
            >
              {renderHighlightedStem(q.question)}
            </p>
            {highlightMode && (
              <p className="text-[10px] uppercase tracking-wider text-yellow-700 dark:text-yellow-300 mb-3">
                Highlighter ON — select any text in the question above to highlight it
              </p>
            )}

            {/* Clinical photos / diagrams (only if the source PDF had any) */}
            <QuestionImages images={q.images} darkMode={state.darkMode} />

            {/* Blurred overlay when paused */}
            <div className={paused ? 'blur-md select-none pointer-events-none' : ''}>
              {/* Answer choices */}
              <div className="space-y-2.5">
                {choiceKeys.map(letter => {
                  const isStruck = !!(state.strikethroughs?.[q.id]?.[letter])
                  return (
                    <div key={letter} className="relative group">
                      <button
                        disabled={isSubmitted}
                        onClick={() => setSelected(letter)}
                        className={`w-full text-left flex items-start gap-3 p-3.5 pr-12 rounded-lg border-2 transition-all duration-200 ${getChoiceStyle(letter)} ${isStruck && !isSubmitted ? 'opacity-50' : ''}`}
                      >
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                          isSubmitted && letter === q.correct_answer ? 'border-green-500 bg-green-100 text-green-700' :
                          isSubmitted && letter === answered?.selected && letter !== q.correct_answer ? 'border-red-500 bg-red-100 text-red-700' :
                          selected === letter ? 'border-blue-500 bg-blue-100 text-blue-700' :
                          'border-gray-300 dark:border-gray-500'
                        }`}>
                          {getChoiceIcon(letter) || letter}
                        </span>
                        <span className={`text-sm leading-relaxed pt-0.5 ${isStruck && !isSubmitted ? 'line-through decoration-2' : ''}`}>
                          {q.choices[letter]}
                        </span>
                      </button>

                      {/* Strikethrough toggle — process-of-elimination aid.
                          Visible faintly until hover on desktop, always full
                          opacity once a choice is struck. Hidden after the
                          user submits (it stops being useful once the
                          answer + explanation are shown). */}
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => dispatch({ type: 'TOGGLE_STRIKE', questionId: q.id, letter })}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center transition ${
                            isStruck
                              ? 'opacity-100 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50'
                              : 'opacity-30 group-hover:opacity-90 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'
                          }`}
                          title={isStruck ? `Remove strikethrough on ${letter}` : `Strike out ${letter}`}
                          aria-label={isStruck ? `Remove strikethrough on ${letter}` : `Strike out ${letter}`}
                        >
                          <X size={15} strokeWidth={isStruck ? 3 : 2.25} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-6">
              {!isSubmitted ? (
                <>
                  <button
                    onClick={handleSubmit}
                    disabled={!selected}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-white transition ${
                      selected ? 'opacity-100 hover:opacity-90' : 'opacity-40 cursor-not-allowed'
                    }`}
                    style={{ backgroundColor: '#2c3e3f' }}
                  >
                    Submit Answer
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2.5 rounded-xl font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Skip
                  </button>
                </>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-white hover:opacity-90 transition"
                  style={{ backgroundColor: '#2c3e3f' }}
                >
                  {currentIndex < totalQ - 1 ? 'Next Question →' : 'Finish Quiz'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Explanation */}
        {isSubmitted && (mode === 'tutor' || mode === 'review') && (
          <ExplanationPanel question={q} answer={answered} darkMode={darkMode} />
        )}
      </div>

      {/* Bottom nav */}
      <footer className={`${bg} border-t dark:border-gray-700 px-4 py-2 flex items-center justify-between`}>
        <button
          onClick={() => dispatch({ type: 'PREV' })}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ChevronLeft size={16} /> Previous
        </button>

        <span className="text-xs text-gray-400">Created by Dr. Osama Al Rawi</span>

        <button
          onClick={handleNext}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Next <ChevronRight size={16} />
        </button>
      </footer>
    </div>
  )
}
