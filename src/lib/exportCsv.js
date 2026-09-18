// Export the student's progress as a CSV they can keep (used / wrong / flagged /
// notes / quiz history). Built entirely from in-memory state.
function esc(v) { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
export function buildProgressCsv(state, lookupQuestion) {
  const rows = [['type', 'pdf_id', 'subtopic', 'category', 'question', 'detail', 'date']]
  const add = (type, pid, detail = '', date = '') => { const q = lookupQuestion(pid); rows.push([type, pid, q?.subtopic || '', q?.category || '', q?.question || '', detail, date]) }
  for (const pid of state.globalUsed || []) add('used', pid)
  for (const pid of state.globalWrong || []) add('wrong', pid, state.mistakes?.[pid]?.reason || '')
  for (const pid of state.globalFlagged || []) add('flagged', pid)
  for (const [pid, note] of Object.entries(state.notes || {})) add('note', pid, note)
  for (const h of state.history || []) rows.push(['quiz', '', '', '', `${h.mode ?? ''} · ${h.source ?? ''}`, `${h.correct ?? ''}/${h.totalQuestions ?? ''} (${h.score ?? ''}%)`, h.date ?? ''])
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}
export function downloadProgressCsv(state, lookupQuestion) {
  const csv = buildProgressCsv(state, lookupQuestion)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `skinscript-progress-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
