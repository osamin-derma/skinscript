import { useMemo, useState } from 'react'
import { AlertOctagon, ExternalLink } from 'lucide-react'

export const MISTAKE_REASONS = [
  { key: 'knowledge', label: 'Knowledge gap' },
  { key: 'misread',   label: 'Misread the question' },
  { key: 'changed',   label: 'Changed my answer' },
  { key: 'guessed',   label: 'Guessed' },
  { key: 'other',     label: 'Other' },
]

/**
 * Mistakes notebook — every question currently marked wrong, with WHY it was
 * missed (error typing). Reviewing the pattern of reasons is one of the
 * best-evidenced study techniques.
 */
export default function Mistakes({ mistakes = {}, globalWrong = [], lookupQuestion, onMistake, onClear, onOpenQuestion, darkMode }) {
  const brand = '#2c3e3f'
  const [filter, setFilter] = useState('all')
  const items = useMemo(() => globalWrong.map((pid) => ({ pid, q: lookupQuestion(pid), m: mistakes[pid] })).filter((it) => it.q), [globalWrong, mistakes, lookupQuestion])
  const counts = useMemo(() => {
    const c = { untagged: 0 }; for (const r of MISTAKE_REASONS) c[r.key] = 0
    for (const it of items) { if (it.m) c[it.m.reason] = (c[it.m.reason] || 0) + 1; else c.untagged++ }
    return c
  }, [items])
  const shown = items.filter((it) => filter === 'all' ? true : filter === 'untagged' ? !it.m : it.m?.reason === filter)
  const bg = darkMode ? 'bg-gray-800' : 'bg-white'
  const card = darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
  const chip = (key, label, n) => (
    <button key={key} onClick={() => setFilter(key)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${filter === key ? 'text-white border-transparent' : darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-200 text-gray-600'}`} style={filter === key ? { backgroundColor: brand } : undefined}>{label} <span className="opacity-70">{n}</span></button>
  )
  return (
    <div className={`${bg} rounded-2xl shadow-xl p-6`}>
      <div className="flex items-center gap-2 mb-1">
        <AlertOctagon size={18} className="text-red-500" /><h2 className="font-bold text-lg">Mistakes</h2>
        <span className="ml-auto text-xs text-gray-400">{items.length} wrong</span>
      </div>
      <p className="text-xs text-gray-400 mb-3">Tag <em>why</em> you missed each one — the pattern tells you what to fix.</p>
      {items.length === 0 ? <p className="text-sm text-gray-500 text-center py-8">No wrong answers right now. 🎉</p> : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {chip('all', 'All', items.length)}{chip('untagged', 'Untagged', counts.untagged)}
            {MISTAKE_REASONS.map((r) => chip(r.key, r.label, counts[r.key] || 0))}
          </div>
          <div className="space-y-2">
            {shown.map(({ pid, q, m }) => (
              <div key={pid} className={`rounded-xl border p-3 ${card}`}>
                <p className="text-sm font-medium line-clamp-2">{q.question}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{q.subtopic || q.category}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {MISTAKE_REASONS.map((r) => (
                    <button key={r.key} onClick={() => onMistake(pid, r.key, m?.note || '')} className={`text-[11px] px-2 py-1 rounded-full border ${m?.reason === r.key ? 'text-white border-transparent' : darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`} style={m?.reason === r.key ? { backgroundColor: brand } : undefined}>{r.label}</button>
                  ))}
                  {m && <button onClick={() => onClear(pid)} className="text-[11px] px-2 py-1 text-gray-400 underline">clear</button>}
                  {onOpenQuestion && <button onClick={() => onOpenQuestion(q)} className="ml-auto text-[11px] flex items-center gap-1 text-gray-500"><ExternalLink size={11} /> open</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
