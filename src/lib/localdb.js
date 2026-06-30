// ─────────────────────────────────────────────────────────────────────────
// Local-first storage (IndexedDB). Two roles:
//
//   • snapshot — the last-known full user-data object (the same shape
//     INIT_FROM_CLOUD expects). Lets the app hydrate instantly and work
//     OFFLINE: on boot we read this before (or instead of) the network.
//
//   • outbox — an ordered queue of pending cloud writes made while offline
//     (or when a write failed). flushOutbox() replays them when back online.
//     Every queued op is an idempotent upsert/delete/insert-with-id, so
//     replaying (even twice) is safe.
//
// Hand-rolled (no dependency). Degrades to a no-op if IndexedDB is
// unavailable (e.g. private mode) — the app still works online.
// ─────────────────────────────────────────────────────────────────────────

const DB_NAME = 'skinscript'
const DB_VERSION = 1
const KV = 'kv'          // snapshot etc., keyed by string
const OUTBOX = 'outbox'  // auto-increment ordered queue

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV)
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: 'seq', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  // If opening fails, don't cache the rejection forever — let a later call retry.
  _dbPromise.catch(() => { _dbPromise = null })
  return _dbPromise
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    let result
    const r = fn(s)
    if (r) r.onsuccess = () => { result = r.result }
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  }))
}

// ── Snapshot ───────────────────────────────────────────────────────────
export async function getSnapshot(userId) {
  try { return (await tx(KV, 'readonly', (s) => s.get(`snap:${userId}`))) || null }
  catch { return null }
}
export async function setSnapshot(userId, data) {
  try { await tx(KV, 'readwrite', (s) => s.put(data, `snap:${userId}`)) }
  catch { /* offline cache is best-effort */ }
}
export async function clearSnapshot(userId) {
  try { await tx(KV, 'readwrite', (s) => s.delete(`snap:${userId}`)) }
  catch { /* ignore */ }
}

// ── Outbox ─────────────────────────────────────────────────────────────
export async function enqueueOp(op) {
  try { await tx(OUTBOX, 'readwrite', (s) => s.add({ ...op, at: undefined })) }
  catch { /* if we can't queue, the write is simply lost offline — rare */ }
}
export async function getOps() {
  try { return (await tx(OUTBOX, 'readonly', (s) => s.getAll())) || [] }
  catch { return [] }
}
export async function removeOp(seq) {
  try { await tx(OUTBOX, 'readwrite', (s) => s.delete(seq)) }
  catch { /* ignore */ }
}
export async function updateOp(op) {
  // op already has its `seq` (keyPath), so put() replaces it in place.
  try { await tx(OUTBOX, 'readwrite', (s) => s.put(op)) }
  catch { /* ignore */ }
}
export async function clearOutbox() {
  try { await tx(OUTBOX, 'readwrite', (s) => s.clear()) }
  catch { /* ignore */ }
}
export async function outboxCount() {
  try { return (await tx(OUTBOX, 'readonly', (s) => s.count())) || 0 }
  catch { return 0 }
}
