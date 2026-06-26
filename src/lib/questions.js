import { supabase } from './supabase'

/**
 * Fetch all question rows the current user is allowed to see, grouped
 * by bank.
 *
 * Returns the same shape the old `allBanks` constant had so the rest of
 * the app keeps working:
 *
 *   {
 *     arabBoard:    { label, questions, count },
 *     boardVitals:  { label, questions, count },
 *     makki:        { label, questions, count },
 *     etas2026:     { label, questions, count },
 *     all:          { label, questions, count },   // union of the four
 *   }
 *
 * Each question object matches the old JSON shape (pdf_id, question,
 * choices, correct_answer, correct_text, explanation, images, …) so the
 * StartScreen / QuizScreen / ExplanationPanel never have to know the
 * source changed.
 *
 * Returned `images` is a list of *full* public URLs, computed from the
 * stored relative paths.  When we switch to a private bucket with signed
 * URLs in Phase 2 this function becomes the only place we need to touch.
 */

const PROJECT_URL = 'https://yssrtjfgkctojkzcoapt.supabase.co'
const STORAGE_BUCKET = 'question-images'

const BANK_LABEL = {
  arabBoard:   'Arab Board',
  boardVitals: 'Board Vitals',
  makki:       'Makki',
  etas2026:    'ETAS 2026',
}
const BANK_OFFSET = {                  // disambiguates ids in the "All" combined bank
  arabBoard:   0,
  boardVitals: 100000,
  makki:       200000,
  etas2026:    300000,
}

function rowToQuestion(row) {
  // Restore the in-app integer id the old code uses for state arrays.
  const offset = BANK_OFFSET[row.bank] ?? 0
  const localId = row.bank_internal_id ?? row.id
  return {
    id:                  offset + localId,
    pdf_id:              row.pdf_id,
    pdf_num:             row.pdf_num,
    question:            row.question,
    choices:             row.choices || {},
    correct_answer:      row.correct_answer || '',
    correct_text:        row.correct_text || '',
    explanation:         row.explanation || '',
    incorrect_rationales: row.incorrect_rationales || {},
    source:              row.source || BANK_LABEL[row.bank],
    category:            row.category || '',
    format:              row.format || 'mcq',
    images:              (row.images || []).map(
      (path) => path.startsWith('http')
        ? path
        : `${PROJECT_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${path}`,
    ),
  }
}


export async function fetchAllBanks() {
  // PostgREST default limit is 1000 rows.  Paginate to get everything.
  const PAGE = 1000
  let all = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from('questions')
      .select(
        'bank, bank_internal_id, pdf_id, pdf_num, question, choices, ' +
        'correct_answer, correct_text, explanation, incorrect_rationales, ' +
        'source, category, format, images',
      )
      .range(from, from + PAGE - 1)
      .order('bank', { ascending: true })
      .order('bank_internal_id', { ascending: true })
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < PAGE) break
    from += PAGE
  }

  // Group by bank
  const grouped = { arabBoard: [], boardVitals: [], makki: [], etas2026: [] }
  for (const row of all) {
    if (grouped[row.bank]) grouped[row.bank].push(rowToQuestion(row))
  }

  const banks = {
    arabBoard:   { label: 'Arab Board',   questions: grouped.arabBoard,   count: grouped.arabBoard.length },
    boardVitals: { label: 'Board Vitals', questions: grouped.boardVitals, count: grouped.boardVitals.length },
    makki:       { label: 'Makki',        questions: grouped.makki,       count: grouped.makki.length },
    etas2026:    { label: 'ETAS 2026',    questions: grouped.etas2026,    count: grouped.etas2026.length },
  }

  banks.all = {
    label: 'All Questions',
    questions: [
      ...banks.arabBoard.questions,
      ...banks.boardVitals.questions,
      ...banks.makki.questions,
      ...banks.etas2026.questions,
    ],
    count: all.length,
  }

  return banks
}


// ─────────────────────────────────────────────────────────────────────
// IndexedDB cache (Phase 1 — offline after first load).
//
// The bank is fetched from Supabase once per DATA_VERSION and cached in
// IndexedDB so subsequent launches are instant and work offline — without
// ever shipping the bank inside the static JS bundle. localStorage can't
// hold ~12 MB, so we use IndexedDB.
// ─────────────────────────────────────────────────────────────────────

const IDB_NAME = 'skinscript'
const IDB_STORE = 'qbank'

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  try {
    const db = await idb()
    return await new Promise((resolve, reject) => {
      const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
      r.onsuccess = () => resolve(r.result)
      r.onerror = () => reject(r.error)
    })
  } catch {
    return undefined
  }
}

async function idbSet(key, value) {
  try {
    const db = await idb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* cache is best-effort — a failure just means we refetch next time */
  }
}

/**
 * Load the banks for a given data version, preferring the local cache.
 *
 *   - Cache hit (same version)  → instant, no network, works offline.
 *   - Cache miss / new version  → fetch from Supabase (auth-gated) + cache.
 *   - Offline with a stale-or-no cache and a failed fetch → throws, so the
 *     caller can show a "connect once to load the bank" message.
 */
export async function loadBanks(dataVersion) {
  const cacheKey = `banks:${dataVersion}`
  const cached = await idbGet(cacheKey)
  if (cached) return cached

  const banks = await fetchAllBanks()

  // Drop any older-version payloads so the cache doesn't grow unbounded.
  try {
    const db = await idb()
    const store = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE)
    const keysReq = store.getAllKeys()
    keysReq.onsuccess = () => {
      for (const k of keysReq.result || []) {
        if (typeof k === 'string' && k.startsWith('banks:') && k !== cacheKey) store.delete(k)
      }
    }
  } catch {
    /* non-fatal */
  }

  await idbSet(cacheKey, banks)
  return banks
}
