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
  if (body?.ping) return json({ ok: true, configured: !!ANTHROPIC_API_KEY })

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
  const { data: allowed, error: rgErr } = await supabase.rpc('rate_guard', {
    p_kind: isSummary ? 'tutor_summary' : 'tutor', p_max: isSummary ? 6 : RATE_MAX, p_window: RATE_WINDOW,
  })
  if (rgErr) { console.error('rate_guard error', rgErr.message); return json({ error: 'rate_check_failed' }, 503) }
  if (allowed === false) return json({ error: 'rate_limited' }, 429)

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

// Shared Anthropic call → { reply } response (errors never reflect upstream detail).
async function callClaude(system: string, messages: { role: string; content: string }[], max_tokens: number): Promise<Response> {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens, system, messages }),
    })
    if (!resp.ok) {
      // Log the upstream detail server-side only; never reflect Anthropic's
      // account/billing/rate-limit messages back to the client.
      const detail = await resp.text()
      console.error('anthropic_error', resp.status, detail.slice(0, 800))
      return json({ error: 'upstream_error' }, 502)
    }
    const data = await resp.json()
    const reply = (data?.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n')
      .trim()
    return json({ reply: reply || '(no response)' })
  } catch (e) {
    console.error('tutor_exception', String(e))
    return json({ error: 'exception' }, 500)
  }
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
