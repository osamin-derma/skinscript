import { useState } from 'react'
import { Users, Flag, ExternalLink, Check } from 'lucide-react'
import { MISTAKE_REASONS } from './Mistakes'

/** "58% of students got this right" — anonymous cohort distribution for this question. */
export function PeerStats({ stats, correct, darkMode }) {
  if (!stats || !stats.n) return null
  const right = Number(stats.counts?.[correct] || 0); const pct = Math.round((right / stats.n) * 100)
  return (
    <div className={`mt-4 rounded-lg px-3 py-2 text-xs flex items-center gap-2 ${darkMode ? 'bg-gray-900/60 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
      <Users size={13} className="shrink-0" />
      <span><strong>{pct}%</strong> of students got this right ({stats.n} attempts)</span>
      <span className="ml-auto text-[10px] text-gray-400">{pct >= 75 ? 'commonly known' : pct >= 45 ? 'moderate' : 'commonly missed'}</span>
    </div>
  )
}

/** After a wrong answer: tag WHY. Feeds the Mistakes notebook. */
export function MistakeTagger({ pdfId, mistake, onMistake, darkMode }) {
  const brand = '#2c3e3f'
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold mb-1.5" style={{ color: darkMode ? '#f87171' : '#dc2626' }}>Why did you miss it?</p>
      <div className="flex flex-wrap gap-1">
        {MISTAKE_REASONS.map((r) => (
          <button key={r.key} onClick={() => onMistake(pdfId, r.key, mistake?.note || '')} className={`text-[11px] px-2 py-1 rounded-full border transition ${mistake?.reason === r.key ? 'text-white border-transparent' : darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`} style={mistake?.reason === r.key ? { backgroundColor: brand } : undefined}>{r.label}</button>
        ))}
      </div>
    </div>
  )
}

/** Flag a wrong key / typo / unclear explanation to the owner. */
export function ReportQuestion({ onReport, darkMode }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState('wrong_answer'); const [comment, setComment] = useState(''); const [sent, setSent] = useState(false)
  if (sent) return <p className="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><Check size={12} /> Reported — thank you.</p>
  return (
    <div className="mt-3">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"><Flag size={11} /> Report a problem with this question</button>
      ) : (
        <div className={`rounded-lg border p-2 ${darkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={`w-full text-xs px-2 py-1 rounded border mb-1.5 ${darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`}>
            <option value="wrong_answer">Answer key seems wrong</option><option value="typo">Typo / formatting</option><option value="unclear">Explanation unclear</option><option value="image">Image missing / wrong</option><option value="other">Other</option>
          </select>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Optional details" className={`w-full text-xs px-2 py-1 rounded border mb-1.5 ${darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300'}`} />
          <div className="flex gap-2"><button onClick={() => { onReport(reason, comment); setSent(true) }} className="text-xs px-3 py-1 rounded text-white" style={{ backgroundColor: '#2c3e3f' }}>Send</button><button onClick={() => setOpen(false)} className="text-xs text-gray-400">Cancel</button></div>
        </div>
      )}
    </div>
  )
}

/** Other questions in the same subtopic. */
export function RelatedQuestions({ related = [], onOpen, darkMode }) {
  if (!related.length) return null
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Related questions · {related[0].subtopic}</p>
      <div className="space-y-1">
        {related.map((q) => (
          <button key={q.pdf_id} onClick={() => onOpen(q)} className={`w-full text-left text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-2 ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}>
            <ExternalLink size={11} className="shrink-0 text-gray-400" /><span className="line-clamp-1">{q.question}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
