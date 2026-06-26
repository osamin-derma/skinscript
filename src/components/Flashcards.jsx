import { useState, useMemo } from 'react'
import { Layers, Check, X as XIcon, Trash2, RotateCcw, ChevronRight } from 'lucide-react'
import { isDue } from '../lib/srs'

/**
 * Flashcards — Anki-style review of the user's cards, sharing the question
 * SRS (Leitner) engine. Two modes:
 *   • Review: flip-and-grade the cards due today (queue captured at start so
 *     a card graded "Missed" doesn't immediately bounce back in the same run).
 *   • Manage: the full deck, each entry deletable.
 *
 * Reads `flashcards` (id -> card). Grades flow out via onReview(id, correct)
 * and deletions via onDelete(id); the app syncs both.
 */
export default function Flashcards({ flashcards = {}, onReview, onDelete, darkMode }) {
  const brand = '#2c3e3f'
  const bg = darkMode ? 'bg-gray-800' : 'bg-white'
  const card = darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'

  const all = useMemo(
    () => Object.values(flashcards).sort((a, b) => (a.front || '').localeCompare(b.front || '')),
    [flashcards],
  )
  const dueIds = useMemo(
    () => Object.values(flashcards).filter((c) => isDue(c)).map((c) => c.id),
    [flashcards],
  )

  // Review session state — queue is frozen when the run starts.
  const [queue, setQueue] = useState(null) // null = not reviewing; array of ids = reviewing
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const startReview = () => {
    if (!dueIds.length) return
    setQueue(dueIds)
    setIdx(0)
    setFlipped(false)
  }
  const endReview = () => { setQueue(null); setIdx(0); setFlipped(false) }

  const grade = (correct) => {
    const id = queue[idx]
    if (id) onReview(id, correct)
    if (idx + 1 >= queue.length) endReview()
    else { setIdx(idx + 1); setFlipped(false) }
  }

  // ── Review mode ──
  if (queue) {
    const current = flashcards[queue[idx]]
    // A card deleted mid-run (shouldn't happen) — skip gracefully.
    if (!current) { endReview(); return null }
    return (
      <div className={`${bg} rounded-2xl shadow-xl p-6`}>
        <div className="flex items-center gap-2 mb-4">
          <Layers size={18} style={{ color: darkMode ? '#7fb5b5' : brand }} />
          <h2 className="font-bold text-lg">Reviewing</h2>
          <span className="ml-auto text-xs text-gray-400">{idx + 1} / {queue.length}</span>
        </div>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className={`w-full text-left rounded-xl border p-6 min-h-[180px] flex flex-col justify-center transition ${card} hover:shadow-md`}
        >
          <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-2">{flipped ? 'Answer' : 'Question'}</p>
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-gray-900 dark:text-gray-100">
            {flipped ? current.back : current.front}
          </p>
          {!flipped && (
            <p className="text-xs text-gray-400 mt-4 flex items-center gap-1"><RotateCcw size={12} /> Tap to reveal answer</p>
          )}
        </button>

        {flipped ? (
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => grade(false)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              <XIcon size={16} /> Missed
            </button>
            <button
              onClick={() => grade(true)}
              className="flex items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/25 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40"
            >
              <Check size={16} /> Got it
            </button>
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-sm text-white"
            style={{ backgroundColor: brand }}
          >
            Show answer
          </button>
        )}

        <button onClick={endReview} className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          End session
        </button>
      </div>
    )
  }

  // ── Deck / manage mode ──
  return (
    <div className={`${bg} rounded-2xl shadow-xl p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <Layers size={18} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <h2 className="font-bold text-lg">Flashcards</h2>
        <span className="ml-auto text-xs text-gray-400">{all.length} card{all.length === 1 ? '' : 's'}</span>
      </div>

      {all.length === 0 ? (
        <div className="text-center py-10">
          <Layers size={26} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No flashcards yet.</p>
          <p className="text-xs text-gray-400 mt-1">Open any question's explanation and tap <span className="font-medium">“Make flashcard.”</span> Cards collect here for spaced review.</p>
        </div>
      ) : (
        <>
          <button
            onClick={startReview}
            disabled={!dueIds.length}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mb-4 ${
              dueIds.length
                ? 'text-white'
                : 'text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-default'
            }`}
            style={dueIds.length ? { backgroundColor: brand } : undefined}
          >
            <Layers size={16} />
            {dueIds.length ? `Review due (${dueIds.length})` : 'No cards due — all caught up'}
          </button>

          <div className="space-y-2">
            {all.map((c) => (
              <div key={c.id} className={`rounded-xl border px-3.5 py-3 flex items-start gap-2.5 ${card}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">{c.front}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 flex items-center gap-1">
                    <ChevronRight size={11} className="shrink-0" /> {c.back}
                  </p>
                  {isDue(c) && <span className="inline-block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">due</span>}
                </div>
                <button
                  onClick={() => onDelete(c.id)}
                  aria-label="Delete card"
                  className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 mt-0.5"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
