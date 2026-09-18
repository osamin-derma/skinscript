import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { tutorAvailable, askSummary } from '../lib/tutor'
import { computeCategoryStats, computeSubtopicStats, computeOverall, computeTrend, computeReadiness, computeStreak } from '../lib/analytics'

const CACHE_KEY = 'skinscript-brief'

/**
 * StudyBrief — an AI-written, personalized study plan built from the
 * student's own stats (weak categories/subtopics, trend, planner). Hidden
 * until the tutor edge function is configured, like TutorPanel.
 */
export default function StudyBrief({ history, lookupQuestion, settings = {}, mistakes = {}, unusedCount = 0, darkMode }) {
  const brand = '#2c3e3f'
  const [avail, setAvail] = useState(false)
  const [text, setText] = useState(() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')?.text || '' } catch { return '' } })
  const [at, setAt] = useState(() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')?.t || 0 } catch { return 0 } })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { let alive = true; tutorAvailable().then((ok) => { if (alive) setAvail(ok) }).catch(() => {}); return () => { alive = false } }, [])

  const snapshot = useMemo(() => {
    const cats = computeCategoryStats(history, lookupQuestion)
    const subs = computeSubtopicStats(history, lookupQuestion)
    const overall = computeOverall(history)
    const trend = computeTrend(history)
    const readiness = computeReadiness(cats, history)
    const streak = computeStreak(history)
    const reasons = {}
    for (const m of Object.values(mistakes)) if (m?.reason) reasons[m.reason] = (reasons[m.reason] || 0) + 1
    let daysToExam = null
    if (settings.examDate) { const t = new Date(); t.setHours(0, 0, 0, 0); daysToExam = Math.round((new Date(settings.examDate + 'T00:00:00') - t) / 86400000) }
    return {
      overall: { attempts: overall.attempts, accuracy: overall.attempts ? Math.round((overall.correct / overall.attempts) * 100) : 0, recentScores: (trend.points || []).slice(-8).map((p) => p.score ?? p.y ?? p) },
      readiness: readiness.band || (readiness.enoughData ? 'unknown' : 'insufficient-data'),
      weakCategories: cats.filter((c) => c.attempts >= 3).slice(0, 6).map((c) => ({ name: c.category, accuracy: c.accuracy, attempts: c.attempts })),
      weakSubtopics: subs.slice(0, 6).map((s) => ({ name: s.subtopic, accuracy: s.accuracy, attempts: s.attempts })),
      mistakeReasons: reasons, dailyGoal: settings.dailyGoal ?? 30, daysToExam, unusedQuestions: unusedCount, streakDays: streak.current,
    }
  }, [history, lookupQuestion, settings, mistakes, unusedCount])

  const enough = snapshot.overall.attempts >= 20
  const generate = async () => {
    if (loading) return
    setLoading(true); setError(null)
    try {
      const reply = await askSummary(snapshot)
      setText(reply); const t = Date.now(); setAt(t)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ text: reply, t })) } catch { /* ignore */ }
    } catch (e) {
      setError(e.message === 'rate_limited' ? 'You can generate a few briefs per hour — try again later.' : 'Could not generate a brief right now.')
    } finally { setLoading(false) }
  }

  if (!avail) return null
  const sub = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'
  return (
    <div className={`rounded-xl border p-4 mb-6 ${sub}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={14} style={{ color: darkMode ? '#7fb5b5' : brand }} />
        <span className="text-sm font-semibold">AI study brief</span>
        {at > 0 && <span className="ml-auto text-[10px] text-gray-400">{new Date(at).toLocaleDateString()}</span>}
      </div>
      {!enough ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Answer at least 20 questions and the tutor will write you a personalized plan from your weak areas.</p>
      ) : (
        <>
          {text ? <Markdownish text={text} darkMode={darkMode} /> : <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">A personalized plan from your weakest categories, subtopics, and your exam date.</p>}
          {error && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>}
          <button onClick={generate} disabled={loading} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg disabled:opacity-60" style={{ backgroundColor: brand }}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : text ? <RefreshCw size={13} /> : <Sparkles size={13} />}
            {loading ? 'Writing…' : text ? 'Regenerate' : 'Write my study brief'}
          </button>
        </>
      )}
    </div>
  )
}

// Tiny markdown subset: ## headings, - bullets, **bold**, paragraphs.
function Markdownish({ text, darkMode }) {
  const lines = String(text).split('\n')
  const out = []
  let bullets = []
  const flush = () => { if (bullets.length) { out.push(<ul key={`ul${out.length}`} className="list-disc pl-5 space-y-0.5 mb-2">{bullets}</ul>); bullets = [] } }
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part)
  lines.forEach((raw, i) => {
    const l = raw.trim()
    if (!l) { flush(); return }
    if (/^#{1,3}\s/.test(l)) { flush(); out.push(<div key={i} className="text-sm font-bold mt-2 mb-1" style={{ color: darkMode ? '#7fb5b5' : '#2c3e3f' }}>{l.replace(/^#+\s/, '')}</div>); return }
    if (/^[-*•]\s/.test(l)) { bullets.push(<li key={i} className="text-sm leading-relaxed">{inline(l.replace(/^[-*•]\s/, ''))}</li>); return }
    if (/^\d+[.)]\s/.test(l)) { bullets.push(<li key={i} className="text-sm leading-relaxed">{inline(l.replace(/^\d+[.)]\s/, ''))}</li>); return }
    flush(); out.push(<p key={i} className="text-sm leading-relaxed mb-2">{inline(l)}</p>)
  })
  flush()
  return <div className="text-gray-800 dark:text-gray-200">{out}</div>
}
