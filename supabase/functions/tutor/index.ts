// ─────────────────────────────────────────────────────────────────────────
// SkinScript AI Tutor — Supabase Edge Function.
//
// A thin, authenticated proxy to the Anthropic Messages API. The API key
// lives ONLY here as a server-side secret (never in the browser bundle), so
// it can't be extracted. Supabase verifies the caller's JWT by default, so
// only signed-in users can invoke it.
//
// Deploy (one-time, from the repo root, with the Supabase CLI logged in):
//   supabase functions deploy tutor --project-ref yssrtjfgkctojkzcoapt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  --project-ref yssrtjfgkctojkzcoapt
//   # optional: supabase secrets set TUTOR_MODEL=claude-haiku-4-5-20251001
//
// The frontend probes this function with { ping: true } and only shows the
// tutor once it answers { ok: true, configured: true } — so until the key is
// set, the feature stays hidden and nothing in the live app breaks.
// ─────────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const MODEL = Deno.env.get('TUTOR_MODEL') || 'claude-haiku-4-5-20251001'

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
If the student asks something unrelated to dermatology or board prep, gently redirect them.

QUESTION CONTEXT
${formatQuestion(q)}`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: any
  try { body = await req.json() } catch { body = {} }

  // Capability probe — no model call, no key required to answer.
  if (body?.ping) return json({ ok: true, configured: !!ANTHROPIC_API_KEY })

  if (!ANTHROPIC_API_KEY) return json({ error: 'not_configured' }, 503)

  const { question, messages } = body
  const clean = Array.isArray(messages)
    ? messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-12) // cap history → bound cost/latency
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : []
  if (clean.length === 0) return json({ error: 'no_messages' }, 400)

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM(question),
        messages: clean,
      }),
    })
    if (!resp.ok) {
      const detail = await resp.text()
      return json({ error: 'upstream_error', status: resp.status, detail: detail.slice(0, 400) }, 502)
    }
    const data = await resp.json()
    const reply = (data?.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('\n')
      .trim()
    return json({ reply: reply || '(no response)' })
  } catch (e) {
    return json({ error: 'exception', detail: String(e).slice(0, 400) }, 500)
  }
})
