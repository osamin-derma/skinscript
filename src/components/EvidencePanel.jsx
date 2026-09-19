import { useEffect, useState } from 'react'
import { BookOpen, ExternalLink, Loader2, Copy, Check } from 'lucide-react'
import { fetchEvidence, pubmedSearchUrl, dermnetUrl, OPENEVIDENCE_URL } from '../lib/evidence'

/**
 * EvidencePanel — "Evidence & further reading" under an explanation: up to
 * five PubMed references (reviews/guidelines preferred) for the correct
 * answer, plus one-tap searches on PubMed, DermNet and OpenEvidence.
 */
export default function EvidencePanel({ question, answerText, darkMode }) {
  const brand = '#2c3e3f'
  const [state, setState] = useState({ status: 'idle', results: [], label: '' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!question) return
    const ctrl = new AbortController()
    setState({ status: 'loading', results: [], label: '' }); setCopied(false)
    // Small delay so flipping quickly through questions doesn't fire lookups.
    const t = setTimeout(() => {
      fetchEvidence(question, answerText, ctrl.signal)
        .then((r) => setState({ status: 'done', results: r.results, label: r.label }))
        .catch((e) => { if (e?.name !== 'AbortError') setState({ status: 'error', results: [], label: '' }) })
    }, 500)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [question?.pdf_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const label = state.label || String(answerText || question?.subtopic || '').slice(0, 80)
  const link = `text-[11px] font-medium inline-flex items-center gap-1 px-2 py-1 rounded-md border ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`
  const copyAndOpen = async () => {
    try { await navigator.clipboard.writeText(label); setCopied(true) } catch { /* ignore */ }
    window.open(OPENEVIDENCE_URL, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen size={13} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <span className="text-xs font-semibold" style={{ color: darkMode ? '#7fb5b5' : brand }}>Evidence & further reading</span>
        {state.status === 'loading' && <Loader2 size={12} className="animate-spin text-gray-400" />}
      </div>
      {state.status === 'done' && state.results.length > 0 && (
        <ol className="space-y-1.5 mb-2">
          {state.results.map((r) => (
            <li key={r.pmid} className="text-[12px] leading-snug">
              <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline text-gray-800 dark:text-gray-100">{r.title}</a>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                {r.authors}{r.authors ? ' · ' : ''}<span className="italic">{r.journal}</span>{r.year ? ` · ${r.year}` : ''}
                {r.review && <span className="ml-1.5 px-1 rounded text-[9px] uppercase tracking-wide" style={{ backgroundColor: darkMode ? '#2c3e3f' : '#e6efef', color: darkMode ? '#7fb5b5' : brand }}>review</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {state.status === 'done' && state.results.length === 0 && <p className="text-[11px] text-gray-400 mb-2">No matching reviews found — try the searches below.</p>}
      {state.status === 'error' && <p className="text-[11px] text-gray-400 mb-2">{typeof navigator !== 'undefined' && navigator.onLine === false ? 'Evidence lookup needs a connection.' : 'Could not reach PubMed right now.'}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <a href={pubmedSearchUrl(label)} target="_blank" rel="noopener noreferrer" className={link}>PubMed <ExternalLink size={10} /></a>
        <a href={dermnetUrl(label)} target="_blank" rel="noopener noreferrer" className={link}>DermNet <ExternalLink size={10} /></a>
        <button type="button" onClick={copyAndOpen} className={link} title="Copies the search term, then opens OpenEvidence (account required)">
          {copied ? <Check size={10} /> : <Copy size={10} />} OpenEvidence
        </button>
        <span className="text-[10px] text-gray-400 ml-1 truncate max-w-[220px]" title={label}>“{label}”</span>
      </div>
    </div>
  )
}
