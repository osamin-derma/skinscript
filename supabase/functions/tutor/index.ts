// ─────────────────────────────────────────────────────────────────────────
// SkinScript AI Tutor — Supabase Edge Function.
//
// A thin, authenticated, RATE-LIMITED proxy to the Anthropic Messages API.
// The API key lives ONLY here as a server-side secret (never in the browser
// bundle), so it can't be extracted.
//
// Defense in depth so the owner's billed key can't be abused:
//   1. Supabase verifies the caller's JWT (pinned in supabase/config.toml:
//      [functions.tutor] verify_jwt = true).
//   2. The function ALSO validates the JWT itself (getUser) and rejects
//      anonymous callers — so a misconfigured deploy still fails closed.
//   3. Every real request is metered per-user via public.rate_guard(...)
//      (requires migration supabase/05_rate_limit_sessions.sql); over-quota
//      callers get 429 instead of spending the owner's tokens.
//
// Deploy (one-time): see supabase/functions/README.md.
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = Deno.env.get('TUTOR_MODEL') || 'claude-haiku-4-5-20251001'
const RATE_MAX = Number(Deno.env.get('TUTOR_RATE_MAX') || '60')      // messages
const RATE_WINDOW = Deno.env.get('TUTOR_RATE_WINDOW') || '1 hour'    // per window
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')      // translation cache writes
const TRANSLATE_MODEL = Deno.env.get('TRANSLATE_MODEL') || 'claude-opus-5'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}

function formatQuestion(q: any): string {
  if (!q) return '(no specific question in context)'
  const choices = q.choices && typeof q.choices === 'object'
    ? Object.entries(q.choices).map(([k, v]) => `   ${k}. ${v}`).join('\n')
    : ''
  return [
    `Stem: ${q.question || ''}`,
    choices ? `Options:\n${choices}` : '',
    q.correct_answer || q.correct_text ? `Correct answer: ${q.correct_answer ? `(${q.correct_answer}) ` : ''}${q.correct_text || (q.choices?.[q.correct_answer] ?? '')}` : '',
    q.explanation ? `Reference explanation: ${q.explanation}` : '',
  ].filter(Boolean).join('\n')
}

const SYSTEM = (q: any) => `You are an expert dermatology board-exam tutor inside the "SkinScript" study app. \
Your student is a dermatology resident preparing for board exams. \
Teach clearly and concisely (a few short paragraphs or a tight list — not an essay). \
Be medically accurate and high-yield; when useful, give a mnemonic, a discriminating feature, or why the distractors are wrong. \
Ground your answer in the question context below and do not contradict its stated correct answer. \
Only help with dermatology and board preparation. If the student asks for anything unrelated (general coding, essays, other domains), briefly decline and steer back to dermatology — do not comply.

QUESTION CONTEXT
${formatQuestion(q)}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: any
  try { body = await req.json() } catch { body = {} }

  // Capability probe — no model call, no auth, no key required to answer.
  if (body?.ping) {
    const base = { ok: true, configured: !!ANTHROPIC_API_KEY && (await keyValid()), v: 6 }
    if (!body?.diag) return json(base)
    // Owner-only diagnostics: surfaces the last upstream error + a live probe.
    if (!(await callerIsAdmin(req))) return json({ ...base, diag: 'forbidden' })
    const probe = await anthropic({ model: MODEL, max_tokens: 5, messages: [{ role: 'user', content: 'Reply with OK.' }] })
    return json({ ...base, diag: { last_upstream: lastUpstream, probe: probe.ok ? { ok: true, text: probe.text } : { ok: false, reason: probe.reason, detail: lastUpstream } } })
  }

  if (!ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503)

  // ── Auth: validate the caller's JWT ourselves (fail closed even if the
  //    platform verify_jwt flag is ever off). ──
  const authHeader = req.headers.get('Authorization') || ''
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !authHeader.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401)
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401)

  // ── Per-user rate limit. rate_guard records the hit and returns false when
  //    over quota. Fail CLOSED if the call errors (e.g. migration 05 not run)
  //    so abuse can never slip through. ──
  const isSummary = !!body?.summary
  const isTranslate = !!body?.translate
  const { data: allowed, error: rgErr } = await supabase.rpc('rate_guard', {
    p_kind: isSummary ? 'tutor_summary' : isTranslate ? 'tutor_translate' : 'tutor',
    p_max: isSummary ? 6 : isTranslate ? 300 : RATE_MAX, p_window: RATE_WINDOW,
  })
  if (rgErr) { console.error('rate_guard error', rgErr.message); return json({ error: 'rate_check_failed' }, 503) }
  if (allowed === false) return json({ error: 'rate_limited' }, 429)

  // ── Translation (Arabic / Russian) of a question or its explanation ──
  if (isTranslate) return translate(body.translate)

  // ── AI study brief: a one-shot personalized plan from the student's stats ──
  if (isSummary) {
    const snap = compactSummary(body.summary)
    const r = await callClaude(SUMMARY_SYSTEM, [{ role: 'user', content: `PERFORMANCE DATA (JSON)\n${JSON.stringify(snap)}` }], 1400)
    return r
  }

  const { question, messages } = body
  const clean = Array.isArray(messages)
    ? messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12) // cap history → bound cost/latency
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : []
  if (clean.length === 0) return json({ error: 'no_messages' }, 400)

  return callClaude(SYSTEM(question), clean, 1024)
})

// Is the configured key actually accepted by Anthropic? Checked with a free
// GET /v1/models call and cached per instance for 10 min, so the app hides the
// tutor / translation controls while the key is missing, wrong or revoked.
let _keyCheck: { at: number; ok: boolean } | null = null
async function keyValid(): Promise<boolean> {
  if (!ANTHROPIC_API_KEY) return false
  if (_keyCheck && Date.now() - _keyCheck.at < 10 * 60 * 1000) return _keyCheck.ok
  let ok = false
  try {
    const r = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } })
    ok = r.ok
    if (!r.ok) console.error('anthropic_key_check', r.status)
  } catch (e) { console.error('anthropic_key_check_exception', String(e)); ok = !!_keyCheck?.ok }
  _keyCheck = { at: Date.now(), ok }
  return ok
}

// Raw Messages API call. Upstream detail is logged server-side only — never
// reflected to the client (account/billing/rate-limit messages stay private).
let lastUpstream: Record<string, unknown> | null = null
async function anthropic(body: Record<string, unknown>): Promise<{ ok: boolean; text: string; stop?: string; reason?: string }> {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const raw = (await resp.text()).slice(0, 800)
      let type = '', message = ''
      try { const j = JSON.parse(raw); type = String(j?.error?.type || ''); message = String(j?.error?.message || '') } catch { message = raw }
      const reason = resp.status === 401 ? 'upstream_auth' : resp.status === 403 ? 'upstream_forbidden' : resp.status === 404 ? 'upstream_model'
        : resp.status === 429 ? 'upstream_rate' : /credit|billing|balance|purchase/i.test(message) ? 'upstream_billing' : resp.status === 529 ? 'upstream_overloaded' : 'upstream_error'
      lastUpstream = { at: new Date().toISOString(), status: resp.status, type, message: message.slice(0, 300), reason }
      console.error('anthropic_error', resp.status, type, message.slice(0, 300))
      return { ok: false, text: '', reason }
    }
    const data = await resp.json()
    const text = (data?.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim()
    if (data?.stop_reason === 'refusal') { console.error('anthropic_refusal', JSON.stringify(data?.stop_details || {})); return { ok: false, text: '' } }
    return { ok: true, text, stop: data?.stop_reason }
  } catch (e) {
    console.error('tutor_exception', String(e))
    return { ok: false, text: '', reason: 'exception' }
  }
}

async function callerIsAdmin(req: Request): Promise<boolean> {
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !authHeader.startsWith('Bearer ')) return false
    const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } })
    const { data } = await c.rpc('is_admin')
    return data === true
  } catch { return false }
}

// Chat / brief → { reply }
async function callClaude(system: string, messages: { role: string; content: string }[], max_tokens: number): Promise<Response> {
  const r = await anthropic({ model: MODEL, max_tokens, system, messages })
  if (!r.ok) return json({ error: r.reason || 'upstream_error' }, 502)
  return json({ reply: r.text || '(no response)' })
}

// ── Translation ───────────────────────────────────────────────────────────
const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic — Modern Standard Arabic in the medical register used by Arab medical faculties',
  ru: 'Russian — the medical register used by Russian medical universities',
}
const TRANSLATE_SYSTEM = (lang: string) => `You are a professional medical translator specialising in dermatology board-examination material. \
Translate the fields of the JSON object you receive from English into ${LANG_NAMES[lang]}.
Rules:
- Translate the meaning exactly. Never add, omit, simplify, explain, or hint at the correct answer.
- Use the standard terminology of that language's dermatology textbooks. Keep drug names, eponyms (Koebner, Nikolsky…), gene/protein symbols, units, abbreviations and Latin names as they are conventionally written in that language's medical literature; if a term has no established equivalent, give the translation followed by the English term in parentheses on first mention.
- Preserve numbers, option letters, lists, line breaks and emphasis. Keep the same number of choices, in the same order, with the same letters.
- Return only the requested JSON.`
const LETTER_ITEM = { type: 'object', properties: { letter: { type: 'string' }, text: { type: 'string' } }, required: ['letter', 'text'], additionalProperties: false }
const SCHEMAS: Record<string, unknown> = {
  question: { type: 'object', properties: { question: { type: 'string' }, choices: { type: 'array', items: LETTER_ITEM } }, required: ['question', 'choices'], additionalProperties: false },
  explanation: { type: 'object', properties: { correct_answer_text: { type: 'string' }, explanation: { type: 'string' }, incorrect_rationales: { type: 'array', items: LETTER_ITEM } }, required: ['correct_answer_text', 'explanation', 'incorrect_rationales'], additionalProperties: false },
}

async function translate(t: any): Promise<Response> {
  const lang = String(t?.lang || '')
  const part = String(t?.part || 'question')
  const pdfId = String(t?.pdf_id || '').slice(0, 64)
  if (!LANG_NAMES[lang] || !SCHEMAS[part] || !pdfId) return json({ error: 'bad_request' }, 400)
  if (!SERVICE_KEY) return json({ error: 'not_configured' }, 503)
  const admin = createClient(SUPABASE_URL!, SERVICE_KEY, { auth: { persistSession: false } })

  // Shared cache: one translation per (question, language, part) for everyone.
  const { data: cached } = await admin.from('question_translations').select('payload').eq('pdf_id', pdfId).eq('lang', lang).eq('part', part).maybeSingle()
  if (cached?.payload) return json({ translation: cached.payload, cached: true })

  const src = t?.source || {}
  const str = (v: unknown, n: number) => String(v ?? '').slice(0, n)
  const letters = (o: any) => Object.keys(o && typeof o === 'object' ? o : {}).filter((k) => /^[A-Z]$/.test(k)).sort()
  let input: Record<string, unknown>
  if (part === 'question') {
    input = { question: str(src.question, 4000), choices: letters(src.choices).map((k) => ({ letter: k, text: str(src.choices[k], 1000) })) }
    if (!input.question) return json({ error: 'bad_request' }, 400)
  } else {
    input = { correct_answer_text: str(src.correct_answer_text, 1000), explanation: str(src.explanation, 8000), incorrect_rationales: letters(src.incorrect_rationales).map((k) => ({ letter: k, text: str(src.incorrect_rationales[k], 2000) })) }
    if (!input.explanation && !input.correct_answer_text) return json({ error: 'bad_request' }, 400)
  }

  const r = await anthropic({
    model: TRANSLATE_MODEL, max_tokens: 6000,
    system: TRANSLATE_SYSTEM(lang),
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMAS[part] } },
  })
  if (!r.ok || r.stop === 'max_tokens') return json({ error: r.reason || 'upstream_error' }, 502)
  let out: any
  try { out = JSON.parse(r.text) } catch { console.error('translate_bad_json', r.text.slice(0, 200)); return json({ error: 'bad_output' }, 502) }
  const toObj = (arr: any) => Object.fromEntries((Array.isArray(arr) ? arr : []).map((x: any) => [String(x?.letter || ''), String(x?.text || '')]).filter(([k]) => k))
  const payload = part === 'question'
    ? { question: String(out?.question || ''), choices: toObj(out?.choices) }
    : { correct_answer_text: String(out?.correct_answer_text || ''), explanation: String(out?.explanation || ''), incorrect_rationales: toObj(out?.incorrect_rationales) }
  const { error } = await admin.from('question_translations').upsert({ pdf_id: pdfId, lang, part, payload, model: TRANSLATE_MODEL }, { onConflict: 'pdf_id,lang,part' })
  if (error) console.error('translate_cache_write', error.message)
  return json({ translation: payload, cached: false })
}

const SUMMARY_SYSTEM = `You are a dermatology board-exam study coach inside the "SkinScript" app. \
You receive a JSON snapshot of one resident's practice statistics. Write a personalized STUDY BRIEF in markdown, under 350 words: \
1) "## Where you stand" — two sentences: overall accuracy, trend, readiness. \
2) "## Focus areas" — the 3–5 weakest categories/subtopics from the data; for EACH give 3 high-yield, board-relevant facts or discriminators to review (dermatology-accurate, specific, no filler). \
3) "## This week" — a concrete day-by-day plan sized to their daily goal, unused questions and days until the exam (if given). \
4) One line on their mistake pattern (e.g. misreads vs knowledge gaps) if data exists. \
Rules: use ONLY the numbers given — never invent scores; be direct and encouraging, no disclaimers, no preamble.`

// Trim + validate the client-sent snapshot so the prompt stays small and
// a malicious client can't stuff arbitrary text into the model.
function compactSummary(s: any) {
  const num = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
  const str = (v: any, n = 60) => String(v ?? '').slice(0, n)
  const list = (a: any, n: number, f: (x: any) => any) => (Array.isArray(a) ? a.slice(0, n).map(f) : [])
  return {
    overall: { attempts: num(s?.overall?.attempts), accuracy: num(s?.overall?.accuracy), recentScores: list(s?.overall?.recentScores, 8, (x) => num(x)) },
    readiness: str(s?.readiness, 20),
    weakCategories: list(s?.weakCategories, 6, (x) => ({ name: str(x?.name), accuracy: num(x?.accuracy), attempts: num(x?.attempts) })),
    weakSubtopics: list(s?.weakSubtopics, 6, (x) => ({ name: str(x?.name), accuracy: num(x?.accuracy), attempts: num(x?.attempts) })),
    mistakeReasons: Object.fromEntries(Object.entries(s?.mistakeReasons || {}).slice(0, 6).map(([k, v]) => [str(k, 12), num(v)])),
    dailyGoal: num(s?.dailyGoal, 30), daysToExam: s?.daysToExam == null ? null : num(s.daysToExam), unusedQuestions: num(s?.unusedQuestions), streakDays: num(s?.streakDays),
  }
}
