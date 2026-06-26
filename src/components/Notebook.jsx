import { useState, useMemo } from 'react'
import { BookOpen, Search, ChevronDown, ChevronUp, Trash2, X as XIcon } from 'lucide-react'

/**
 * Notebook — every question the user has written a note on, in one place.
 * Each entry expands to the full question, choices (correct highlighted),
 * explanation, and the editable note. Reads `notes` (pdf_id -> text) and
 * resolves questions via lookupQuestion; edits/deletes flow back through
 * onNote(pdf_id, text) (empty text deletes), which the app syncs.
 */
export default function Notebook({ notes = {}, lookupQuestion, onNote, darkMode }) {
  const brand = '#2c3e3f'
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(null)

  const items = useMemo(() => {
    return Object.entries(notes)
      .map(([pdf_id, note]) => ({ pdf_id, note, q: lookupQuestion(pdf_id) }))
      .filter((it) => it.q && (it.note || '').trim())
      .filter((it) => {
        if (!query.trim()) return true
        const hay = `${it.note} ${it.q.question} ${it.q.category || ''}`.toLowerCase()
        return hay.includes(query.toLowerCase())
      })
  }, [notes, lookupQuestion, query])

  const total = Object.values(notes).filter((n) => (n || '').trim()).length
  const card = darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
  const bg = darkMode ? 'bg-gray-800' : 'bg-white'

  return (
    <div className={`${bg} rounded-2xl shadow-xl p-6`}>
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={18} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <h2 className="font-bold text-lg">Notebook</h2>
        <span className="ml-auto text-xs text-gray-400">{total} note{total === 1 ? '' : 's'}</span>
      </div>

      {total === 0 ? (
        <div className="text-center py-10">
          <BookOpen size={26} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add a note under any question's explanation and it'll collect here.</p>
        </div>
      ) : (
        <>
          <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-200'}`}>
            <Search size={15} className="text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your notes"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {query && <button onClick={() => setQuery('')} aria-label="Clear"><XIcon size={14} className="text-gray-400" /></button>}
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">No notes match “{query}”.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it, idx) => {
                const q = it.q
                const isOpen = open === it.pdf_id
                return (
                  <div key={it.pdf_id} className={`rounded-xl border overflow-hidden ${card}`}>
                    <button
                      onClick={() => setOpen(isOpen ? null : it.pdf_id)}
                      className="w-full flex items-start gap-2.5 px-3.5 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600/40"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{q.question}</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5 line-clamp-2">{it.note}</p>
                        {q.category && <span className="text-[10px] text-gray-400">{q.category}</span>}
                      </div>
                      {isOpen ? <ChevronUp size={15} className="text-gray-400 mt-0.5" /> : <ChevronDown size={15} className="text-gray-400 mt-0.5" />}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
                        <p className="text-sm font-medium mt-3 mb-2 whitespace-pre-line">{q.question}</p>
                        <div className="space-y-1 mb-3">
                          {Object.entries(q.choices || {}).sort().map(([letter, text]) => (
                            <div key={letter} className={`py-1.5 px-2 rounded text-xs ${
                              letter === q.correct_answer
                                ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'text-gray-600 dark:text-gray-300'
                            }`}>
                              <strong>{letter}.</strong> {text}{letter === q.correct_answer && ' ✓'}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div className="mb-3 p-3 rounded-lg text-xs leading-relaxed whitespace-pre-line bg-blue-50 dark:bg-blue-900/20 text-gray-700 dark:text-gray-200">
                            {q.explanation}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-xs font-semibold" style={{ color: darkMode ? '#d4b966' : brand }}>My note</span>
                          <button
                            onClick={() => { onNote(it.pdf_id, ''); setOpen(null) }}
                            className="ml-auto flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                        <textarea
                          defaultValue={it.note}
                          onChange={(e) => onNote(it.pdf_id, e.target.value)}
                          rows={3}
                          className={`w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 resize-y ${
                            darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-amber-50/40 border-amber-200 text-gray-900'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
