import { useState, useMemo, useEffect, useCallback } from 'react'
import { Images, Search, X as XIcon, ChevronLeft, ChevronRight, ExternalLink, ImageOff } from 'lucide-react'

/**
 * Atlas — a browsable clinical-image library built from every question that
 * carries a photo (≈2,950 images across the bank). Browse/filter by category,
 * search by keyword. Tiles show the image + its category only: the questions
 * are not all "spot diagnosis" (the correct answer is often a mechanism,
 * treatment, or feature — not the image's diagnosis), so labelling each tile
 * with the answer would mislead. Instead the lightbox shows the actual
 * question stem, a "Reveal answer" step, and a deep-link to the full question
 * with its explanation.
 *
 * Reads the combined "all" bank (each question keeps its all-bank id + pdf_id);
 * onOpenQuestion(q) jumps to that question in review mode.
 */
const PAGE = 60

export default function Atlas({ questions = [], darkMode, onOpenQuestion }) {
  const brand = '#2c3e3f'
  const bg = darkMode ? 'bg-gray-800' : 'bg-white'

  // One entry per image (a question may carry several).
  const items = useMemo(() => {
    const out = []
    for (const q of questions) {
      const imgs = Array.isArray(q.images) ? q.images : []
      imgs.forEach((url, i) => out.push({ url, q, idx: i }))
    }
    return out
  }, [questions])

  const categories = useMemo(() => {
    const c = new Map()
    for (const it of items) {
      const k = it.q.category || 'Other'
      c.set(k, (c.get(k) || 0) + 1)
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const [lightbox, setLightbox] = useState(null) // index into `filtered`
  const [revealed, setRevealed] = useState(false)

  const filtered = useMemo(() => {
    const ql = query.trim().toLowerCase()
    return items.filter((it) => {
      if (cat !== 'all' && (it.q.category || 'Other') !== cat) return false
      if (!ql) return true
      const answer = it.q.correct_text || it.q.choices?.[it.q.correct_answer] || ''
      return `${answer} ${it.q.question} ${it.q.category || ''}`.toLowerCase().includes(ql)
    })
  }, [items, cat, query])

  // Reset paging whenever the filter changes.
  useEffect(() => { setVisible(PAGE) }, [cat, query])
  // Each time a new card opens, hide the answer again.
  useEffect(() => { setRevealed(false) }, [lightbox])

  const shown = filtered.slice(0, visible)

  const closeLb = useCallback(() => setLightbox(null), [])
  const stepLb = useCallback((d) => {
    setLightbox((i) => {
      if (i === null) return i
      const n = i + d
      return n < 0 || n >= filtered.length ? i : n
    })
  }, [filtered.length])

  // Keyboard nav for the lightbox.
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeLb()
      else if (e.key === 'ArrowRight') stepLb(1)
      else if (e.key === 'ArrowLeft') stepLb(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, closeLb, stepLb])

  const current = lightbox !== null ? filtered[lightbox] : null
  const currentAnswer = current ? (current.q.correct_text || current.q.choices?.[current.q.correct_answer] || '') : ''

  return (
    <div className={`${bg} rounded-2xl shadow-xl p-6`}>
      <div className="flex items-center gap-2 mb-1">
        <Images size={18} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <h2 className="font-bold text-lg">Atlas</h2>
        <span className="ml-auto text-xs text-gray-400">{filtered.length.toLocaleString()} image{filtered.length === 1 ? '' : 's'}</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">Browse clinical images by category. Tap any image for the question and answer.</p>

      {items.length === 0 ? (
        <div className="text-center py-10">
          <ImageOff size={26} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No images available.</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border ${darkMode ? 'bg-gray-900 border-gray-600' : 'bg-white border-gray-200'}`}>
            <Search size={15} className="text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by keyword, diagnosis, or finding"
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {query && <button onClick={() => setQuery('')} aria-label="Clear"><XIcon size={14} className="text-gray-400" /></button>}
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            <CatChip label="All" count={items.length} active={cat === 'all'} onClick={() => setCat('all')} darkMode={darkMode} brand={brand} />
            {categories.map(([k, n]) => (
              <CatChip key={k} label={k} count={n} active={cat === k} onClick={() => setCat(k)} darkMode={darkMode} brand={brand} />
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No images match “{query}”.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {shown.map((it) => (
                  <button
                    key={`${it.q.pdf_id}-${it.idx}`}
                    type="button"
                    onClick={() => setLightbox(filtered.indexOf(it))}
                    className={`group relative overflow-hidden rounded-xl border text-left transition hover:shadow-md ${
                      darkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-100 border-gray-200'
                    }`}
                  >
                    <img
                      src={it.url}
                      alt="Clinical image"
                      loading="lazy"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-full h-36 object-cover select-none"
                      style={{ WebkitUserDrag: 'none', WebkitTouchCallout: 'none' }}
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                    />
                    <div className="absolute bottom-0 inset-x-0 px-2.5 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
                      <p className="text-[11px] font-medium text-white/95">{it.q.category || 'Other'}</p>
                    </div>
                  </button>
                ))}
              </div>

              {visible < filtered.length && (
                <div className="text-center mt-5">
                  <button
                    onClick={() => setVisible((v) => v + PAGE)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    Show more ({(filtered.length - visible).toLocaleString()} left)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={closeLb}
          onContextMenu={(e) => e.preventDefault()}
          role="dialog"
        >
          <button onClick={closeLb} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Close"><XIcon size={20} /></button>

          {lightbox > 0 && (
            <button onClick={(e) => { e.stopPropagation(); stepLb(-1) }} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Previous"><ChevronLeft size={22} /></button>
          )}
          {lightbox < filtered.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); stepLb(1) }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-10" aria-label="Next"><ChevronRight size={22} /></button>
          )}

          <div className="max-w-xl w-full max-h-[92vh] overflow-auto flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={current.url}
              alt="Clinical image"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-[58vh] max-w-full object-contain rounded-lg shadow-2xl select-none"
              style={{ WebkitUserDrag: 'none', WebkitTouchCallout: 'none' }}
            />
            <div className="mt-3 px-4 py-3 rounded-xl bg-white/10 text-white w-full">
              <p className="text-[11px] text-white/50 mb-1">{current.q.category || 'Other'}{current.q.source ? ` · ${current.q.source}` : ''}</p>
              <p className="text-sm leading-relaxed">{current.q.question}</p>

              {revealed ? (
                <p className="mt-3 text-sm">
                  <span className="text-white/50">Answer: </span>
                  <span className="font-semibold text-emerald-300">{currentAnswer || '—'}</span>
                </p>
              ) : (
                <button onClick={() => setRevealed(true)} className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25">
                  Reveal answer
                </button>
              )}

              <div className="flex items-center justify-between mt-3">
                {onOpenQuestion ? (
                  <button
                    onClick={() => { closeLb(); onOpenQuestion(current.q) }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25"
                  >
                    <ExternalLink size={13} /> Open full question
                  </button>
                ) : <span />}
                <span className="text-[10px] text-white/40">{lightbox + 1} / {filtered.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CatChip({ label, count, active, onClick, darkMode, brand }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        active
          ? 'text-white border-transparent'
          : darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
      }`}
      style={active ? { backgroundColor: brand } : undefined}
    >
      {label} <span className={active ? 'text-white/70' : 'text-gray-400'}>{count}</span>
    </button>
  )
}
