/**
 * Analytics derived entirely client-side from the per-question detail saved in
 * quiz history ([{ pdf_id, selected }] per exam). No new tables: every metric
 * replays saved exams against the bundled bank, resolving each pdf_id to its
 * question (category + correct answer). Older exams without detail simply
 * contribute nothing — metrics degrade gracefully (we always surface the
 * attempt count so sparse data reads as low-confidence, not as "0%").
 */

// Aggregate accuracy per category across every saved exam.
// lookupQuestion(pdf_id) -> question | undefined.
export function computeCategoryStats(history, lookupQuestion) {
  const byCat = new Map()
  for (const h of history || []) {
    if (!Array.isArray(h.detail)) continue
    for (const item of h.detail) {
      const q = lookupQuestion(item.pdf_id)
      const cat = q?.category
      if (!q || !cat) continue
      if (!byCat.has(cat)) byCat.set(cat, { category: cat, attempts: 0, correct: 0 })
      const s = byCat.get(cat)
      s.attempts += 1
      if (item.selected != null && item.selected === q.correct_answer) s.correct += 1
    }
  }
  return [...byCat.values()]
    .map((s) => ({ ...s, accuracy: s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
}

// Overall attempts/correct from saved detail (independent of category coverage).
export function computeOverall(history) {
  let attempts = 0
  let correct = 0
  for (const h of history || []) {
    if (!Array.isArray(h.detail)) continue
    for (const item of h.detail) {
      attempts += 1
      // correctness re-derivable, but we don't have the answer here; callers
      // that need correctness use computeCategoryStats. This is just volume.
    }
  }
  return { attempts, correct }
}

// Score trend over time. history arrives newest-first; return chronological
// points plus a moving average so one bad quiz doesn't look like a collapse.
export function computeTrend(history, window = 5) {
  const points = (history || [])
    .filter((h) => typeof h.score === 'number' && h.date)
    .slice()
    .reverse()
    .map((h) => ({ date: h.date, score: h.score }))
  const movingAvg = points.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = points.slice(start, i + 1)
    return Math.round(slice.reduce((a, p) => a + p.score, 0) / slice.length)
  })
  let slope = 0
  if (points.length >= 2) slope = points[points.length - 1].score - points[0].score
  return { points, movingAvg, slope }
}

// Weakest categories with enough attempts to be meaningful.
export function rankWeakCategories(stats, { minAttempts = 8, limit = 3 } = {}) {
  return (stats || []).filter((s) => s.attempts >= minAttempts).slice(0, limit)
}

// Calibration: accuracy at each confidence level (guessed/unsure/sure), from
// saved exam detail ({pdf_id, selected, conf}). Surfaces overconfidence — being
// "sure" yet wrong.
export function computeConfidenceStats(history, lookupQuestion) {
  const order = ['sure', 'unsure', 'guessed']
  const by = { sure: { attempts: 0, correct: 0 }, unsure: { attempts: 0, correct: 0 }, guessed: { attempts: 0, correct: 0 } }
  for (const h of history || []) {
    if (!Array.isArray(h.detail)) continue
    for (const item of h.detail) {
      if (!item.conf || !by[item.conf]) continue
      const q = lookupQuestion(item.pdf_id)
      if (!q) continue
      by[item.conf].attempts += 1
      if (item.selected != null && item.selected === q.correct_answer) by[item.conf].correct += 1
    }
  }
  return order
    .map((level) => ({ level, ...by[level], accuracy: by[level].attempts ? Math.round((by[level].correct / by[level].attempts) * 100) : 0 }))
    .filter((s) => s.attempts > 0)
}

// A cautious readiness read. Gated behind a data floor so a sparse user sees
// "keep practicing", never a false green. Heuristic only — clearly labeled.
export function computeReadiness(categoryStats, history) {
  const attempts = (categoryStats || []).reduce((a, s) => a + s.attempts, 0)
  const correct = (categoryStats || []).reduce((a, s) => a + s.correct, 0)
  const quizzes = (history || []).filter((h) => Array.isArray(h.detail) && h.detail.length).length
  const enoughData = attempts >= 200 && quizzes >= 5
  const pct = attempts ? Math.round((correct / attempts) * 100) : 0
  let band = 'low'
  if (pct >= 75) band = 'on-track'
  else if (pct >= 60) band = 'borderline'
  return { enoughData, pct, attempts, quizzes, band }
}

// ── Streaks & daily goal (derived from quiz history dates) ──────────────

function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Current + longest run of consecutive calendar days with a quiz (local dates).
// "current" counts the run ending today or yesterday, so a streak isn't lost
// until a full day has actually been skipped.
export function computeStreak(history, now = Date.now()) {
  const DAY = 86400000
  const days = new Set((history || []).filter((h) => h.date).map((h) => dayKey(h.date)))

  let current = 0
  let cursor = now
  if (!days.has(dayKey(cursor))) cursor -= DAY
  while (days.has(dayKey(cursor))) { current += 1; cursor -= DAY }

  let longest = 0
  for (const k of days) {
    const [y, m, d] = k.split('-').map(Number)
    if (days.has(dayKey(new Date(y, m, d).getTime() - DAY))) continue // not a run start
    let run = 0, t = new Date(y, m, d).getTime()
    while (days.has(dayKey(t))) { run += 1; t += DAY }
    if (run > longest) longest = run
  }
  return { current, longest, studyDays: days.size }
}

// Questions answered today (sum across today's quizzes).
export function todayAnswered(history, now = Date.now()) {
  const today = dayKey(now)
  return (history || [])
    .filter((h) => h.date && dayKey(h.date) === today)
    .reduce((a, h) => a + (h.answered ?? h.totalQuestions ?? 0), 0)
}
