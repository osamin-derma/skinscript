/**
 * Spaced-repetition scheduling (Leitner ladder). A correct answer promotes the
 * question to the next, longer interval; a wrong answer resets it to the start.
 * Intentionally simple + predictable (vs full SM-2): one box index into a fixed
 * day ladder. Entries are stored per pdf_id as { box, interval, due, reps }.
 */
export const LADDER = [1, 3, 7, 16, 35, 90] // days
const MAX_BOX = LADDER.length - 1
const DAY = 24 * 60 * 60 * 1000

// Given the previous schedule entry (or undefined for a first review) and
// whether the answer was correct, return the next entry.
export function nextSchedule(prev, correct, now = Date.now()) {
  let box
  if (correct) box = prev ? Math.min(prev.box + 1, MAX_BOX) : 0
  else box = 0 // reset to the start on a miss
  const interval = LADDER[box]
  return {
    box,
    interval,
    due: new Date(now + interval * DAY).toISOString(),
    reps: (prev?.reps || 0) + 1,
    lastGrade: correct ? 1 : 0,
  }
}

// Is this entry due now?
export function isDue(entry, now = Date.now()) {
  return entry && entry.due && new Date(entry.due).getTime() <= now
}

// pdf_ids currently due, from a { [pdf_id]: entry } map.
export function duePdfIds(schedule, now = Date.now()) {
  const out = []
  for (const [pid, e] of Object.entries(schedule || {})) if (isDue(e, now)) out.push(pid)
  return out
}
