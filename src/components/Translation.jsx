import { useEffect, useState } from 'react'
import { Languages, Loader2, RefreshCw } from 'lucide-react'
import { LANGS, translateQuestion, getTranslateLang, setTranslateLang } from '../lib/translate'
import { tutorAvailable } from '../lib/tutor'

/** Header control: "Translate: Off / العربية / Русский". Hidden until the tutor function is configured. */
export function TranslateSelect({ lang, onChange, darkMode }) {
  const [avail, setAvail] = useState(false)
  useEffect(() => { let alive = true; tutorAvailable().then((ok) => { if (alive) setAvail(ok) }).catch(() => {}); return () => { alive = false } }, [])
  if (!avail) return null
  return (
    <label className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${lang ? 'border-teal-600/60 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30' : 'border-gray-200 dark:border-gray-600'}`} title="Translate this question">
      <Languages size={14} />
      <select value={lang} onChange={(e) => { setTranslateLang(e.target.value); onChange(e.target.value) }} aria-label="Translate question" className={`bg-transparent outline-none text-xs ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
        <option value="">English</option>
        {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
    </label>
  )
}

/** Fetch (and cache) a translation of `q`; part = 'question' | 'explanation'. */
export function useTranslation(q, lang, part = 'question') {
  const [state, setState] = useState({ status: 'idle', tr: null })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!lang || !q?.pdf_id) { setState({ status: 'idle', tr: null }); return }
    let alive = true
    setState({ status: 'loading', tr: null })
    translateQuestion(q, lang, part)
      .then((tr) => { if (alive) setState({ status: 'done', tr }) })
      .catch((e) => { if (alive) setState({ status: 'error', tr: null, code: String(e?.message || '') }) })
    return () => { alive = false }
  }, [q?.pdf_id, lang, part, nonce])
  return { ...state, retry: () => setNonce((n) => n + 1) }
}

/** A translated line/paragraph with the right direction + language attributes. */
export function TranslatedText({ text, lang, className = '' }) {
  if (!text || !LANGS[lang]) return null
  return <span lang={lang} dir={LANGS[lang].dir} className={`block ${LANGS[lang].dir === 'rtl' ? 'text-right' : ''} ${className}`}>{text}</span>
}

/** Small status pill for loading / error states. */
export function TranslationStatus({ status, code, lang, onRetry, darkMode }) {
  if (!lang || status === 'idle' || status === 'done') return null
  const cls = `inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`
  if (status === 'loading') return <span className={cls}><Loader2 size={12} className="animate-spin" /> Translating to {LANGS[lang].name}…</span>
  const msg = code === 'rate_limited' ? 'Translation limit reached for now.' : (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'Translation needs a connection.' : 'Translation unavailable.'
  return <span className={cls}>{msg} <button type="button" onClick={onRetry} className="inline-flex items-center gap-0.5 underline"><RefreshCw size={11} /> retry</button></span>
}

export { getTranslateLang }
