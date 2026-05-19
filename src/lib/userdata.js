import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────
// User-data cloud sync.
//
// All progress that used to live in localStorage (history / flags / wrong /
// used) is now per-user in Supabase.  These helpers are thin wrappers
// around the REST + RPC API that the React reducer fires-and-forgets
// when state changes.
//
// Errors are logged but never thrown into the UI — a flaky network
// shouldn't crash a study session.
// ─────────────────────────────────────────────────────────────────────────

// Read the current user id from the cached session (synchronous after the
// initial auth bootstrap — no network call).  getUser() makes a request
// to /auth/v1/user and would silently return null on a flaky network,
// which is exactly the kind of failure that left old rows behind on
// "Reset ALL" → that's why this is now getSession().
async function uid() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id || null
}

function warn(label, err) {
  if (err) console.warn('[userdata]', label, err.message || err)
}


// ── Initial load ─────────────────────────────────────────────────────────

export async function fetchAllUserData() {
  const userId = await uid()
  if (!userId) return { flags: [], wrong: [], used: [], history: [] }

  const [flagsRes, wrongRes, usedRes, historyRes] = await Promise.all([
    supabase.from('user_flags').select('question_id'),
    supabase.from('user_wrong').select('question_id'),
    supabase.from('user_used').select('question_id'),
    supabase.from('quiz_history')
      .select('*')
      .order('taken_at', { ascending: false })
      .limit(100),
  ])

  warn('fetch flags',   flagsRes.error)
  warn('fetch wrong',   wrongRes.error)
  warn('fetch used',    usedRes.error)
  warn('fetch history', historyRes.error)

  return {
    flags:   (flagsRes.data   || []).map(r => r.question_id),
    wrong:   (wrongRes.data   || []).map(r => r.question_id),
    used:    (usedRes.data    || []).map(r => r.question_id),
    history: (historyRes.data || []).map(rowToHistoryEntry),
  }
}

function rowToHistoryEntry(r) {
  return {
    id: r.id,
    date: r.taken_at,
    mode: r.mode,
    source: r.source,
    bank: r.bank,
    totalQuestions: r.total_questions,
    answered: r.answered,
    correct: r.correct,
    incorrect: r.incorrect,
    score: r.score,
    timePerQ: r.time_per_q,
  }
}


// ── Flags ────────────────────────────────────────────────────────────────

export async function addFlag(questionId) {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase
    .from('user_flags')
    .upsert({ user_id: userId, question_id: questionId }, { onConflict: 'user_id,question_id' })
  warn('addFlag', error)
}

export async function removeFlag(questionId) {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase
    .from('user_flags')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId)
  warn('removeFlag', error)
}


// ── Wrong ────────────────────────────────────────────────────────────────

export async function addWrong(questionId) {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase
    .from('user_wrong')
    .upsert({ user_id: userId, question_id: questionId, last_wrong_at: new Date().toISOString() },
            { onConflict: 'user_id,question_id' })
  warn('addWrong', error)
}

export async function removeWrong(questionId) {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase
    .from('user_wrong')
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId)
  warn('removeWrong', error)
}


// ── Used ─────────────────────────────────────────────────────────────────
// "Used" only ever grows during normal play; we never selectively remove a
// single entry. Clearing happens via clearProgress() below.

export async function addUsed(questionId) {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase
    .from('user_used')
    .upsert({ user_id: userId, question_id: questionId, last_used_at: new Date().toISOString() },
            { onConflict: 'user_id,question_id' })
  warn('addUsed', error)
}


// ── History ──────────────────────────────────────────────────────────────

export async function insertHistory(entry) {
  const userId = await uid(); if (!userId) return null
  const { data, error } = await supabase
    .from('quiz_history')
    .insert({
      user_id:         userId,
      mode:            entry.mode,
      source:          entry.source,
      bank:            entry.bank,
      total_questions: entry.totalQuestions,
      answered:        entry.answered,
      correct:         entry.correct,
      incorrect:       entry.incorrect,
      score:           entry.score,
      time_per_q:      entry.timePerQ,
    })
    .select()
    .single()
  warn('insertHistory', error)
  return data ? rowToHistoryEntry(data) : null
}

export async function clearHistory() {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase.from('quiz_history').delete().eq('user_id', userId)
  warn('clearHistory', error)
}


// ── Bulk reset (matches the existing "Reset Performance" + RESET_ALL) ────

export async function clearProgress() {
  const userId = await uid()
  if (!userId) {
    console.warn('[userdata] clearProgress: no user id, nothing to clear')
    return false
  }
  const results = await Promise.all([
    supabase.from('user_flags').delete().eq('user_id', userId),
    supabase.from('user_wrong').delete().eq('user_id', userId),
    supabase.from('user_used' ).delete().eq('user_id', userId),
  ])
  let ok = true
  results.forEach((r, i) => {
    const label = ['flags', 'wrong', 'used'][i]
    if (r.error) {
      console.error('[userdata] clearProgress', label, 'failed:', r.error)
      ok = false
    } else {
      console.log('[userdata] cleared', label, 'for user', userId)
    }
  })
  return ok
}

export async function clearEverything() {
  const userId = await uid()
  if (!userId) {
    console.warn('[userdata] clearEverything: no user id, aborting')
    return false
  }
  console.log('[userdata] clearEverything starting for user', userId)
  const histRes = await supabase.from('quiz_history').delete().eq('user_id', userId)
  if (histRes.error) console.error('[userdata] history delete failed:', histRes.error)
  else console.log('[userdata] cleared history for user', userId)
  const progressOk = await clearProgress()
  return !histRes.error && progressOk
}
