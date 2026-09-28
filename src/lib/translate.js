import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────
// Question translation (Arabic / Russian). Lookup order:
//   1. in-memory memo (this tab)
//   2. public.question_translations — shared cache, readable by every student
//   3. the `tutor` edge function (translate mode) → translates with Claude and
//      stores the result in the shared cache for everyone after.
// ─────────────────────────────────────────────────────────────────────────
export const LANGS = {
  ar: { label: 'العربية', name: 'Arabic', dir: 'rtl', explanationTitle: 'الشرح', correctLabel: 'الإجابة الصحيحة', wrongLabel: 'الإجابات الخاطئة' },
  ru: { label: 'Русский', name: 'Russian', dir: 'ltr', explanationTitle: 'Объяснение', correctLabel: 'Правильный ответ', wrongLabel: 'Неправильные ответы' },
}
const LS_KEY = 'skinscript-translate-lang'
export function getTranslateLang() { try { const v = localStorage.getItem(LS_KEY); return LANGS[v] ? v : '' } catch { return '' } }
export function setTranslateLang(v) { try { if (LANGS[v]) localStorage.setItem(LS_KEY, v); else localStorage.removeItem(LS_KEY) } catch { /* ignore */ } }

const memo = new Map()
const inflight = new Map()

function payloadFor(q, part) {
  if (part === 'question') return { question: q.question || '', choices: q.choices || {} }
  const correctText = (q.correct_answer && q.choices?.[q.correct_answer]) || q.correct_text || ''
  return { correct_answer_text: correctText, explanation: q.explanation || '', incorrect_rationales: q.incorrect_rationales || {} }
}

export async function translateQuestion(q, lang, part = 'question') {
  if (!q?.pdf_id || !LANGS[lang]) throw new Error('bad_request')
  const key = `${q.pdf_id}|${lang}|${part}`
  if (memo.has(key)) return memo.get(key)
  if (inflight.has(key)) return inflight.get(key)
  const p = (async () => {
    // 2. shared cache
    try {
      const { data } = await supabase.from('question_translations').select('payload').eq('pdf_id', q.pdf_id).eq('lang', lang).eq('part', part).maybeSingle()
      if (data?.payload) { memo.set(key, data.payload); return data.payload }
    } catch { /* fall through to the function */ }
    // 3. translate now (server stores it)
    const { data, error } = await supabase.functions.invoke('tutor', { body: { translate: { lang, part, pdf_id: q.pdf_id, source: payloadFor(q, part) } } })
    if (error) throw new Error(error.message || 'request_failed')
    if (data?.error) throw new Error(data.error)
    if (!data?.translation) throw new Error('empty')
    memo.set(key, data.translation)
    return data.translation
  })()
  inflight.set(key, p)
  try { return await p } finally { inflight.delete(key) }
}
