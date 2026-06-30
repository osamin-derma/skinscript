import { supabase } from './supabase'
import * as localdb from './localdb'

// ─────────────────────────────────────────────────────────────────────────
// User-data cloud sync — now LOCAL-FIRST.
//
// Reads: see fetchAllUserData. The app hydrates from the local snapshot
// (localdb) first, so it works offline; when online it then reconciles with
// the cloud.
//
// Writes: every incremental mutation goes through mutate(kind, args). When
// offline (or a write fails on the network) the op is appended to the
// IndexedDB outbox and replayed by flushOutbox() on reconnect. Every op is an
// idempotent upsert/delete/insert-with-id, so replaying twice is harmless.
//
// Errors are logged but never thrown into the UI — a flaky network shouldn't
// crash a study session.
// ─────────────────────────────────────────────────────────────────────────

async function uid() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.user?.id || null
}

function warn(label, err) {
  if (err) console.warn('[userdata]', label, err.message || err)
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false


// ── Initial load ─────────────────────────────────────────────────────────

export async function fetchAllUserData() {
  const userId = await uid()
  if (!userId) return { flags: [], wrong: [], used: [], history: [], notes: {}, highlights: {}, schedule: {}, flashcards: {} }

  const [flagsRes, wrongRes, usedRes, historyRes, notesRes, hlRes, schedRes, fcRes] = await Promise.all([
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
    supabase.from('user_flashcards').select('id, pdf_id, front, back, box, interval_days, due_at, reps'),
  ])

  warn('fetch flags',      flagsRes.error)
  warn('fetch wrong',      wrongRes.error)
  warn('fetch used',       usedRes.error)
  warn('fetch history',    historyRes.error)
  warn('fetch notes',      notesRes.error)
  warn('fetch highlights', hlRes.error)
  warn('fetch schedule',   schedRes.error)
  warn('fetch flashcards', fcRes.error)

  const notes = {}
  for (const r of notesRes.data || []) { if (r.note) notes[r.pdf_id] = r.note }
  const highlights = {}
  for (const r of hlRes.data || []) { if (Array.isArray(r.ranges) && r.ranges.length) highlights[r.pdf_id] = r.ranges }
  const schedule = {}
  for (const r of schedRes.data || []) {
    schedule[r.pdf_id] = { box: r.box, interval: r.interval_days, due: r.due_at, reps: r.reps, lastGrade: r.last_grade }
  }
  const flashcards = {}
  for (const r of fcRes.data || []) {
    flashcards[r.id] = { id: r.id, pdf_id: r.pdf_id, front: r.front, back: r.back, box: r.box, interval: r.interval_days, due: r.due_at, reps: r.reps }
  }

  return {
    flags:   (flagsRes.data   || []).map(r => r.question_id),
    wrong:   (wrongRes.data   || []).map(r => r.question_id),
    used:    (usedRes.data    || []).map(r => r.question_id),
    history: (historyRes.data || []).map(rowToHistoryEntry),
    notes,
    highlights,
    schedule,
    flashcards,
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


// ── Raw executors (one per mutation kind) ────────────────────────────────
// Each performs the Supabase write and RETURNS the error (or null). They are
// the single source of truth for the write, used both for live writes and for
// replaying the offline outbox — so they MUST be idempotent.

const EXECUTORS = {
  async saveNote(pdfId, note) {
    const userId = await uid(); if (!userId) return null
    const text = (note || '').trim()
    if (!text) {
      const { error } = await supabase.from('user_notes').delete().eq('user_id', userId).eq('pdf_id', pdfId)
      return error
    }
    const { error } = await supabase.from('user_notes')
      .upsert({ user_id: userId, pdf_id: pdfId, note: text, updated_at: new Date().toISOString() }, { onConflict: 'user_id,pdf_id' })
    return error
  },
  async saveHighlights(pdfId, ranges) {
    const userId = await uid(); if (!userId) return null
    if (!Array.isArray(ranges) || ranges.length === 0) {
      const { error } = await supabase.from('user_highlights').delete().eq('user_id', userId).eq('pdf_id', pdfId)
      return error
    }
    const { error } = await supabase.from('user_highlights')
      .upsert({ user_id: userId, pdf_id: pdfId, ranges, updated_at: new Date().toISOString() }, { onConflict: 'user_id,pdf_id' })
    return error
  },
  async saveScheduleEntry(pdfId, entry) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_review_schedule')
      .upsert({
        user_id: userId, pdf_id: pdfId,
        box: entry.box, interval_days: entry.interval, due_at: entry.due,
        reps: entry.reps, last_grade: entry.lastGrade, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,pdf_id' })
    return error
  },
  async saveFlashcard(card) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_flashcards')
      .upsert({
        id: card.id, user_id: userId, pdf_id: card.pdf_id || null,
        front: card.front, back: card.back,
        box: card.box, interval_days: card.interval, due_at: card.due, reps: card.reps,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,id' })
    return error
  },
  async deleteFlashcard(id) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_flashcards').delete().eq('user_id', userId).eq('id', id)
    return error
  },
  async addFlag(questionId) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_flags')
      .upsert({ user_id: userId, question_id: questionId }, { onConflict: 'user_id,question_id' })
    return error
  },
  async removeFlag(questionId) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_flags').delete().eq('user_id', userId).eq('question_id', questionId)
    return error
  },
  async addWrong(questionId) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_wrong')
      .upsert({ user_id: userId, question_id: questionId, last_wrong_at: new Date().toISOString() }, { onConflict: 'user_id,question_id' })
    return error
  },
  async removeWrong(questionId) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_wrong').delete().eq('user_id', userId).eq('question_id', questionId)
    return error
  },
  async addUsed(questionId) {
    const userId = await uid(); if (!userId) return null
    const { error } = await supabase.from('user_used')
      .upsert({ user_id: userId, question_id: questionId, last_used_at: new Date().toISOString() }, { onConflict: 'user_id,question_id' })
    return error
  },
  async insertHistory(entry) {
    const userId = await uid(); if (!userId) return null
    // Client-generated uuid id (set by END_QUIZ) → upsert is idempotent, so a
    // queued offline insert can be replayed safely without duplicating rows.
    const base = {
      id: entry.id, user_id: userId,
      mode: entry.mode, source: entry.source, bank: entry.bank,
      total_questions: entry.totalQuestions, answered: entry.answered,
      correct: entry.correct, incorrect: entry.incorrect, score: entry.score,
      time_per_q: entry.timePerQ,
      taken_at: entry.date || new Date().toISOString(),
    }
    let { error } = await supabase.from('quiz_history').upsert({ ...base, detail: entry.detail || null }, { onConflict: 'id' })
    // `detail` ships before its migration may be run; fall back without it.
    if (error && /detail/i.test(`${error.message} ${error.details || ''}`)) {
      ;({ error } = await supabase.from('quiz_history').upsert(base, { onConflict: 'id' }))
    }
    return error
  },
}


// ── mutate(): the local-first write path ─────────────────────────────────
// Each op is stamped with the user it belongs to, so a queued write can never
// replay into a different account. A write goes through the outbox whenever
// we're offline, OR while the outbox already has pending ops / a flush is in
// flight — otherwise a fresh "live" write could land in the cloud BEFORE an
// older queued write for the same key, leaving the wrong final value.

const MAX_ATTEMPTS = 8
let _flushing = false
let _flushTimer = null

function scheduleFlush() {
  if (_flushTimer || isOffline()) return
  _flushTimer = setTimeout(() => { _flushTimer = null; flushOutbox() }, 4000)
}

async function mutate(kind, args) {
  const userId = await uid()
  if (!userId) return // not signed in — nothing to persist
  const pending = await localdb.outboxCount()
  if (isOffline() || pending > 0 || _flushing) {
    await localdb.enqueueOp({ kind, args, userId, attempts: 0 })
    scheduleFlush()
    return
  }
  let error = null
  try { error = await EXECUTORS[kind](...args) } catch (e) { error = e }
  if (error) {
    // Queue for retry on ANY error — executors are idempotent, so re-running
    // is safe, and dropping a write (the old behaviour) silently lost data.
    await localdb.enqueueOp({ kind, args, userId, attempts: 0 })
    scheduleFlush()
  }
}

// Replay queued writes, oldest first. Only the CURRENT user's ops are run;
// another account's queued ops are left untouched for when they sign back in.
// A failed op is retried (with an attempt cap) rather than dropped, and we
// stop on the first failure so ordering is preserved.
export async function flushOutbox() {
  if (_flushing || isOffline()) return
  const userId = await uid()
  if (!userId) return // never flush without a confirmed session (would mis-attribute)
  _flushing = true
  try {
    const ops = await localdb.getOps()
    for (const op of ops) {
      if (isOffline()) break
      if (op.userId && op.userId !== userId) continue // belongs to another account
      let error = null
      try { error = await EXECUTORS[op.kind]?.(...op.args) } catch (e) { error = e }
      if (!error) { await localdb.removeOp(op.seq); continue } // applied
      const attempts = (op.attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        console.warn('[outbox] dropping op after', MAX_ATTEMPTS, 'attempts:', op.kind, error?.message || error)
        await localdb.removeOp(op.seq)
        continue
      }
      await localdb.updateOp({ ...op, attempts })
      break // keep order; retry the rest later
    }
  } finally {
    _flushing = false
  }
}

export async function outboxCount() { return localdb.outboxCount() }


// ── Offline snapshot (instant hydration / read-while-offline) ────────────
// Stores/loads the full INIT_FROM_CLOUD-shaped object for the current user.

export async function loadSnapshot() {
  const userId = await uid(); if (!userId) return null
  return localdb.getSnapshot(userId)
}
// Caller passes the user id the data belongs to (captured at call time). We
// only write if it still matches the live session, so an in-flight save can't
// land under a different account after a same-tab sign-in switch.
export async function saveSnapshot(expectedUserId, data) {
  const userId = await uid()
  if (!userId || (expectedUserId && userId !== expectedUserId)) return
  await localdb.setSnapshot(userId, data)
}


// ── Public write helpers (unchanged signatures) ──────────────────────────

export const addFlag           = (questionId) => mutate('addFlag', [questionId])
export const removeFlag        = (questionId) => mutate('removeFlag', [questionId])
export const saveNote          = (pdfId, note) => mutate('saveNote', [pdfId, note])
export const saveHighlights    = (pdfId, ranges) => mutate('saveHighlights', [pdfId, ranges])
export const saveScheduleEntry = (pdfId, e) => mutate('saveScheduleEntry', [pdfId, e])
export const saveFlashcard     = (card) => mutate('saveFlashcard', [card])
export const deleteFlashcard   = (id) => mutate('deleteFlashcard', [id])
export const addWrong          = (questionId) => mutate('addWrong', [questionId])
export const removeWrong       = (questionId) => mutate('removeWrong', [questionId])
export const addUsed           = (questionId) => mutate('addUsed', [questionId])
export const insertHistory     = (entry) => mutate('insertHistory', [entry])


// ── Bulk resets — direct (not queued); also clear local cache + outbox ───

export async function clearSchedule() {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase.from('user_review_schedule').delete().eq('user_id', userId)
  warn('clearSchedule', error)
}

export async function clearHistory() {
  const userId = await uid(); if (!userId) return
  const { error } = await supabase.from('quiz_history').delete().eq('user_id', userId)
  warn('clearHistory', error)
}

export async function clearProgress() {
  const userId = await uid()
  if (!userId) { console.warn('[userdata] clearProgress: no user id, nothing to clear'); return false }
  const results = await Promise.all([
    supabase.from('user_flags').delete().eq('user_id', userId),
    supabase.from('user_wrong').delete().eq('user_id', userId),
    supabase.from('user_used' ).delete().eq('user_id', userId),
  ])
  let ok = true
  results.forEach((r, i) => {
    const label = ['flags', 'wrong', 'used'][i]
    if (r.error) { console.error('[userdata] clearProgress', label, 'failed:', r.error); ok = false }
  })
  return ok
}

export async function clearEverything() {
  const userId = await uid()
  if (!userId) { console.warn('[userdata] clearEverything: no user id, aborting'); return false }
  // Drop any pending offline writes + local snapshot so a reset can't be
  // undone by a stale queued op replaying later.
  await localdb.clearOutbox()
  await localdb.clearSnapshot(userId)
  const histRes = await supabase.from('quiz_history').delete().eq('user_id', userId)
  if (histRes.error) console.error('[userdata] history delete failed:', histRes.error)
  const notesRes = await supabase.from('user_notes').delete().eq('user_id', userId)
  if (notesRes.error) console.error('[userdata] notes delete failed:', notesRes.error)
  const hlRes = await supabase.from('user_highlights').delete().eq('user_id', userId)
  if (hlRes.error) console.error('[userdata] highlights delete failed:', hlRes.error)
  const schedRes = await supabase.from('user_review_schedule').delete().eq('user_id', userId)
  if (schedRes.error) console.error('[userdata] schedule delete failed:', schedRes.error)
  const fcRes = await supabase.from('user_flashcards').delete().eq('user_id', userId)
  if (fcRes.error) console.error('[userdata] flashcards delete failed:', fcRes.error)
  const progressOk = await clearProgress()
  return !histRes.error && !notesRes.error && !hlRes.error && !schedRes.error && !fcRes.error && progressOk
}
