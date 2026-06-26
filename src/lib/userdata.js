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
  if (!userId) return { flags: [], wrong: [], used: [], history: [], notes: {}, highlights: {}, schedule: {} }

  const [flagsRes, wrongRes, usedRes, historyRes, notesRes, hlRes, schedRes] = await Promise.all([
    supabase.from('user_flags').select('question_id'),
    supabase.from('user_wrong').select('question_id'),
    supabase.from('user_used').select('question_id'),
    supabase.from('quiz_history')
      .select('*')
      .order('taken_at', { ascending: false })
      .limit(100),
    supabase.from('user_notes').select('pdf_id, note'),
    supabase.from('user_highlights').select('pdf_id, ranges'),
    supabase.from('user_review_schedule').select('pdf_id, box, interval_days, due_at, reps, last_grade'),
  ])

  warn('fetch flags',      flagsRes.error)
  warn('fetch wrong',      wrongRes.error)
  warn('fetch used',       usedRes.error)
  warn('fetch history',    historyRes.error)
  warn('fetch notes',      notesRes.error)
  warn('fetch highlights', hlRes.error)
  warn('fetch schedule',   schedRes.error)

  const notes = {}
  for (const r of notesRes.data || []) { if (r.note) notes[r.pdf_id] = r.note }
  const highlights = {}
  for (const r of hlRes.data || []) { if (Array.isArray(r.ranges) && r.ranges.length) highlights[r.pdf_id] = r.ranges }
  const schedule = {}
  for (const r of schedRes.data || []) {
    schedule[r.pdf_id] = { box: r.box, interval: r.interval_days, due: r.due_at, reps: r.reps, lastGrade: r.last_grade }
  }

  return {
    flags:   (flagsRes.data   || []).map(r => r.question_id),
    wrong:   (wrongRes.data   || []).map(r => r.question_id),
    used:    (usedRes.data    || []).map(r => r.question_id),
    history: (historyRes.data || []).map(rowToHistoryEntry),
    notes,
    highlights,
    schedule,
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
    detail: r.detail || null,
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


// ── Per-question notes ───────────────────────────────────────────────────

// Empty text deletes the note; otherwise upsert. Keyed on pdf_id.
export async function saveNote(pdfId, note) {
  const userId = await uid(); if (!userId) return
  const text = (note || '').trim()
  if (!text) {
    const { error } = await supabase
      .from('user_notes')
      .delete()
      .eq('user_id', userId)
      .eq('pdf_id', pdfId)
    warn('deleteNote', error)
    return
  }
  const { error } = await supabase
    .from('user_notes')
    .upsert({ user_id: userId, pdf_id: pdfId, note: text, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,pdf_id' })
  warn('saveNote', error)
}


// ── Persistent highlights ────────────────────────────────────────────────

// Empty ranges deletes the row; otherwise upsert. Keyed on pdf_id.
export async function saveHighlights(pdfId, ranges) {
  const userId = await uid(); if (!userId) return
  if (!Array.isArray(ranges) || ranges.length === 0) {
    const { error } = await supabase
      .from('user_highlights')
      .delete()
      .eq('user_id', userId)
      .eq('pdf_id', pdfId)
    warn('deleteHighlights', error)
    return
  }
  const { error } = await supabase
    .from('user_highlights')
    .upsert({ user_id: userId, pdf_id: pdfId, ranges, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,pdf_id' })
  warn('saveHighlights', error)
}


// ── Spaced-repetition schedule ───────────────────────────────────────────

// Upsert one question's review schedule entry (fire-and-forget on answer).
export async function saveScheduleEntry(pdfId, entry) {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase
    .from('user_review_schedule')
    .upsert({
      user_id: userId, pdf_id: pdfId,
      box: entry.box, interval_days: entry.interval, due_at: entry.due,
      reps: entry.reps, last_grade: entry.lastGrade,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,pdf_id' })
  warn('saveScheduleEntry', error)
}

export async function clearSchedule() {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase.from('user_review_schedule').delete().eq('user_id', userId)
  warn('clearSchedule', error)
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
  const base = {
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
  }
  let { data, error } = await supabase
    .from('quiz_history')
    .insert({ ...base, detail: entry.detail || null })
    .select()
    .single()
  // The `detail` column ships before its migration may be run (07_quiz_history_detail.sql).
  // If it's missing, fall back to inserting without it so history still syncs;
  // per-exam review just won't persist to the cloud until the column exists.
  if (error && /detail/i.test(`${error.message} ${error.details || ''}`)) {
    ;({ data, error } = await supabase.from('quiz_history').insert(base).select().single())
  }
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
  // Also wipe per-question annotations so "start fresh" is truly clean and they
  // don't silently rehydrate (both keyed on the stable pdf_id).
  const notesRes = await supabase.from('user_notes').delete().eq('user_id', userId)
  if (notesRes.error) console.error('[userdata] notes delete failed:', notesRes.error)
  const hlRes = await supabase.from('user_highlights').delete().eq('user_id', userId)
  if (hlRes.error) console.error('[userdata] highlights delete failed:', hlRes.error)
  const schedRes = await supabase.from('user_review_schedule').delete().eq('user_id', userId)
  if (schedRes.error) console.error('[userdata] schedule delete failed:', schedRes.error)
  const progressOk = await clearProgress()
  return !histRes.error && !notesRes.error && !hlRes.error && !schedRes.error && progressOk
}
