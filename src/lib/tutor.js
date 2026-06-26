import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────
// AI Tutor client. Talks to the `tutor` Supabase Edge Function, which holds
// the Anthropic key server-side. The tutor UI is hidden until the function
// answers a capability ping with { ok, configured: true } — so when the
// function isn't deployed (or the key isn't set), the feature simply doesn't
// appear and the live app keeps working.
// ─────────────────────────────────────────────────────────────────────────

const CAP_KEY = 'skinscript-tutor-cap'
const CAP_TTL = 30 * 60 * 1000 // re-probe at most every 30 min
let _mem // in-memory result for this tab: true | false | undefined
let _inflight // de-dupe concurrent probes

export async function tutorAvailable() {
  if (_mem !== undefined) return _mem
  try {
    const cached = JSON.parse(localStorage.getItem(CAP_KEY) || 'null')
    if (cached && Date.now() - cached.t < CAP_TTL) {
      _mem = !!cached.v
      return _mem
    }
  } catch { /* ignore */ }

  if (!_inflight) {
    _inflight = (async () => {
      let ok = false
      try {
        const { data, error } = await supabase.functions.invoke('tutor', { body: { ping: true } })
        ok = !error && !!data?.ok && !!data?.configured
      } catch { ok = false }
      _mem = ok
      try { localStorage.setItem(CAP_KEY, JSON.stringify({ v: ok, t: Date.now() })) } catch { /* ignore */ }
      _inflight = null
      return ok
    })()
  }
  return _inflight
}

// Force the next call to re-probe (e.g. after the user sets up the function).
export function resetTutorCache() {
  _mem = undefined
  _inflight = null
  try { localStorage.removeItem(CAP_KEY) } catch { /* ignore */ }
}

// Send the question context + chat history, return the assistant's reply text.
export async function askTutor(question, messages) {
  const { data, error } = await supabase.functions.invoke('tutor', { body: { question, messages } })
  if (error) throw new Error(error.message || 'request_failed')
  if (data?.error) throw new Error(data.error)
  return data?.reply || ''
}
