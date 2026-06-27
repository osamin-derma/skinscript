import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────
// AI Tutor client. Talks to the `tutor` Supabase Edge Function, which holds
// the Anthropic key server-side. The tutor UI is hidden until the function
// answers a capability ping with { ok, configured: true } — so when the
// function isn't deployed (or the key isn't set), the feature simply doesn't
// appear and the live app keeps working.
// ─────────────────────────────────────────────────────────────────────────

const CAP_KEY = 'skinscript-tutor-cap'
const POS_TTL = 30 * 60 * 1000 // trust an "available" result for 30 min
const NEG_TTL = 90 * 1000      // re-probe an "unavailable" result after 90s
let _mem // ONLY pinned true once available; never pinned false (a transient
         // probe failure must not hide the tutor for the whole tab session)
let _inflight // de-dupe concurrent probes

export async function tutorAvailable() {
  if (_mem === true) return true
  try {
    const cached = JSON.parse(localStorage.getItem(CAP_KEY) || 'null')
    if (cached && Date.now() - cached.t < (cached.v ? POS_TTL : NEG_TTL)) return !!cached.v
  } catch { /* ignore */ }

  if (!_inflight) {
    _inflight = (async () => {
      let ok = false
      try {
        const { data, error } = await supabase.functions.invoke('tutor', { body: { ping: true } })
        ok = !error && !!data?.ok && !!data?.configured
      } catch { ok = false }
      if (ok) _mem = true // pin positives only
      // Negatives get a short TTL so a transient blip doesn't hide the tutor
      // for 30 min; a genuine "not deployed" simply re-probes every ~90s.
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
