// questions.js — auth-gated question-bank loader (replaces the bundled JSON).
//
// This is the finished version of src/lib/questions.js: all SIX banks, with
// the _bank tag, subtopic, source and the exact id offsets App.jsx used, plus
// signed image URLs for a private bucket. When you're ready to wire it in,
// copy this over src/lib/questions.js.
//
// Data path: Supabase `questions` table (RLS: authenticated-only) → grouped
// into banks → cached in IndexedDB per DATA_VERSION so later launches are
// instant/offline. The bank is NEVER in the static JS bundle.

import { supabase } from './supabase'
import subtopicsRaw from '../data/subtopics.json'

const STORAGE_BUCKET = 'question-images'
const SIGNED_URL_TTL = 60 * 60 * 24 * 7   // 7 days

// pdf_id → subtopic name (same mapping App.jsx used; this is harmless
// metadata and may stay bundled).
const SUBTOPIC_OF = new Map(
  Object.entries(subtopicsRaw.map).map(([pid, i]) => [pid, subtopicsRaw.names[i]]),
)

const BANK_LABEL = {
  arabBoard: 'Arab Board', boardVitals: 'Board Vitals', makki: 'Makki',
  etas2026: 'ETAS 2026', dse: 'DSE – Al-Niaimi', abd: 'ABD – Dermatology',
}
// Must match the offsets App.jsx used so combined-bank ids stay unique.
const BANK_OFFSET = {
  arabBoard: 0, boardVitals: 100000, makki: 200000,
  etas2026: 300000, dse: 400000, abd: 500000,
}
const BANK_KEYS = Object.keys(BANK_LABEL)

function rowToQuestion(row) {
  const offset = BANK_OFFSET[row.bank] ?? 0
  const localId = row.bank_internal_id ?? row.id
  return {
    id: offset + localId,
    pdf_id: row.pdf_id,
    pdf_num: row.pdf_num,
    question: row.question,
    choices: row.choices || {},
    correct_answer: row.correct_answer || '',
    correct_text: row.correct_text || '',
    explanation: row.explanation || '',
    incorrect_rationales: row.incorrect_rationales || {},
    source: row.source || BANK_LABEL[row.bank],
    category: row.category || '',
    format: row.format || 'mcq',
    subtopic: SUBTOPIC_OF.get(row.pdf_id) || row.category || 'General dermatology',
    _bank: row.bank,
    // relative storage paths until signed (see resolveImageUrls)
    images: Array.isArray(row.images) ? row.images.slice() : [],
  }
}

async function fetchAllRows() {
  const PAGE = 1000
  let all = []
  for (let from = 0; ; from += PAGE) {
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
  }
  return all
}

// Count shows quizzable questions (≥2 choices + a correct answer), not raw
// rows, so every bank badge equals the practiceable pool (card === TOTAL).
const isQuizzableQ = (q) => q.choices && Object.keys(q.choices).length >= 2 && q.correct_answer
const qzCount = (arr) => arr.reduce((n, q) => n + (isQuizzableQ(q) ? 1 : 0), 0)

function groupIntoBanks(rows) {
  const grouped = Object.fromEntries(BANK_KEYS.map((k) => [k, []]))
  for (const row of rows) if (grouped[row.bank]) grouped[row.bank].push(rowToQuestion(row))
  const banks = {}
  for (const k of BANK_KEYS) banks[k] = { label: BANK_LABEL[k], questions: grouped[k], count: qzCount(grouped[k]) }
  banks.all = {
    label: 'All Questions',
    questions: BANK_KEYS.flatMap((k) => banks[k].questions),
    count: BANK_KEYS.reduce((n, k) => n + banks[k].count, 0),
  }
  return banks
}

// Best-effort: turn relative image paths into short-lived signed URLs for the
// private bucket. If it fails (e.g. offline) the relative paths are left as-is
// — text still works; images just won't load until the next online load.
async function resolveImageUrls(banks) {
  const withImg = banks.all.questions.filter((q) => q.images?.some((p) => p && !p.startsWith('http')))
  const paths = [...new Set(withImg.flatMap((q) => q.images.filter((p) => p && !p.startsWith('http'))))]
  if (!paths.length) return banks
  const signed = new Map()
  for (let i = 0; i < paths.length; i += 1000) {
    const slice = paths.slice(i, i + 1000)
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(slice, SIGNED_URL_TTL)
    if (error) return banks            // offline / not permitted → keep relative
    for (const r of data || []) if (r.signedUrl) signed.set(r.path, r.signedUrl)
  }
  for (const q of withImg) q.images = q.images.map((p) => signed.get(p) || p)
  return banks
}

export async function fetchAllBanks() {
  const banks = groupIntoBanks(await fetchAllRows())
  return resolveImageUrls(banks)
}

// ── IndexedDB cache (text only; images re-signed each load) ───────────────
const IDB_NAME = 'skinscript', IDB_STORE = 'qbank'
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
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error)
    })
  } catch { return undefined }
}
async function idbSet(key, value) {
  try {
    const db = await idb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
    })
  } catch { /* best-effort */ }
}

/**
 * Load banks for a data version, preferring the local cache.
 *   cache hit  → instant; re-sign image URLs (needs network for images only)
 *   cache miss → fetch from Supabase (auth-gated) + cache
 * Throws if there is no cache AND the fetch fails (offline first run) so the
 * caller can show a "connect once to load the question bank" message.
 */
export async function loadBanks(dataVersion) {
  const cacheKey = `banks:${dataVersion}`
  const cached = await idbGet(cacheKey)
  if (cached) return resolveImageUrls(cached)

  const banks = groupIntoBanks(await fetchAllRows())
  // Cache text with RELATIVE image paths (stable, no expiring URLs).
  await idbSet(cacheKey, banks)
  try {                                 // drop older-version payloads
    const db = await idb()
    const store = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE)
    const req = store.getAllKeys()
    req.onsuccess = () => (req.result || []).forEach((k) => {
      if (typeof k === 'string' && k.startsWith('banks:') && k !== cacheKey) store.delete(k)
    })
  } catch { /* non-fatal */ }
  return resolveImageUrls(banks)
}
