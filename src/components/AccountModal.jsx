import { useState, useEffect, useRef } from 'react'
import { X, Mail, Phone, Lock, Trophy, User, CalendarDays, Check, AlertCircle, LogOut, ChevronRight, ChevronLeft, Medal, Loader2, Trash2, Settings } from 'lucide-react'
import PhoneInput from './PhoneInput'
import ExamReview from './ExamReview'
import OfflineDownload from './OfflineDownload'
import RefreshButton from './RefreshButton'
import RemindersToggle from './RemindersToggle'
import { Download } from 'lucide-react'
import { updateEmail, updatePassword, startPhoneChange, confirmPhoneChange, normalizePhone, deleteAccount } from '../lib/auth'
import { fetchLeaderboard } from '../lib/userdata'

/**
 * Account panel — a side drawer opened by clicking the username chip on the
 * StartScreen (full-width on mobile, fixed sidebar on desktop).
 *
 * Organised as a HUB + sub-pages rather than one long scroll:
 *   - Hub:  profile card + a short menu (Account details · Previous exams ·
 *           Settings & data) + Sign out.
 *   - Account details:  change email, mobile number, password; delete account.
 *   - Previous exams:   the full exam list — tap one to review it question by
 *                       question (ExamReview, via `lookupQuestion`).
 *   - Settings & data:  export progress, refresh, reminders, offline images.
 * The sticky top bar gives a labelled way back at every level, kept clear of
 * the iOS status bar by the safe-area inset.
 */
export default function AccountModal({ currentUser, history = [], darkMode, onClose, onSignOut, lookupQuestion, imageUrls = [], onExport, onRetake, settings = {}, onSettings, solvedCount = 0, globalFlagged = [] }) {
  const brand = '#2c3e3f'
  const closeRef = useRef(null)
  const [shown, setShown] = useState(false)
  const [view, setView] = useState('home')          // 'home' | 'account' | 'exams' | 'settings'
  const [selectedExam, setSelectedExam] = useState(null)
  const [deleting, setDeleting] = useState(false)   // block dismissal mid-delete

  // Back / Home: step back through the panel's pages — an open exam review
  // returns to the exam list, any sub-page returns to the hub, and the hub
  // itself closes the drawer (back to the landing screen).
  const goBack = () => {
    if (deleting) return
    if (selectedExam) setSelectedExam(null)
    else if (view !== 'home') setView('home')
    else onClose()
  }

  // Slide in on mount; Escape = go back one level; focus into the drawer on open.
  useEffect(() => {
    setShown(true)
    const onKey = (e) => {
      if (deleting || e.key !== 'Escape') return
      if (selectedExam) setSelectedExam(null)
      else if (view !== 'home') setView('home')
      else onClose()
    }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, selectedExam, deleting, view])

  // While an account deletion is in flight, ignore backdrop / X / Escape so the
  // confirming component can't unmount mid-request (which would drop its error).
  const guardedClose = () => { if (!deleting) onClose() }

  const name = currentUser?.username || (currentUser?.email || '').split('@')[0] || 'You'
  const initial = (name[0] || 'U').toUpperCase()
  const joined = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  // Top-bar state: at the hub the left button says "Home" (closes to the landing
  // screen); on any sub-page it says "Back" and the bar shows the page title.
  const atHome = view === 'home' && !selectedExam
  const title = selectedExam ? 'Exam review'
    : view === 'account' ? 'Account'
    : view === 'exams' ? 'Previous exams'
    : view === 'settings' ? 'Settings & data'
    : ''

  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  const sub = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'
  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 ${
    darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
  }`

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-start bg-black/50 backdrop-blur-sm"
      onClick={guardedClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div
        className={`relative h-full w-full sm:max-w-md border-r shadow-2xl ${card} overflow-y-auto transform transition-transform duration-300 ease-out sm:rounded-r-2xl ${shown ? 'translate-x-0' : '-translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky top bar — a clearly labelled, always-reachable way back.
            Padded by the safe-area inset so it never slips behind the iOS
            status bar (clock / battery / Wi-Fi), and sticky so it stays in
            reach while the panel scrolls. */}
        <div
          className={`sticky top-0 z-10 flex items-center gap-2 px-3 pb-2 border-b backdrop-blur-sm ${darkMode ? 'bg-gray-800/90 border-gray-700' : 'bg-white/90 border-gray-200'}`}
          style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top))' }}
        >
          <button
            ref={closeRef}
            onClick={goBack}
            disabled={deleting}
            className="flex items-center gap-1 -ml-1 pr-2.5 py-1.5 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            <ChevronLeft size={18} /> {atHome ? 'Home' : 'Back'}
          </button>
          <span className="flex-1 text-center text-sm font-semibold truncate px-1" style={{ color: darkMode ? '#7fb5b5' : brand }}>{title}</span>
          <button
            onClick={guardedClose}
            disabled={deleting}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Exam review (opened from Previous exams) ───────────────── */}
        {selectedExam ? (
          <div className="p-5">
            <ExamReview exam={selectedExam} lookupQuestion={lookupQuestion} darkMode={darkMode} globalFlagged={globalFlagged} onBack={() => setSelectedExam(null)} onRetake={onRetake} showBack={false} />
          </div>
        ) : view === 'account' ? (
          /* ── Account: email, mobile number, password, delete ───────── */
          <div className="p-5 space-y-4">
            <EmailSection currentEmail={currentUser?.email} inputCls={inputCls} sub={sub} brand={brand} />
            <PhoneSection currentPhone={currentUser?.phone} inputCls={inputCls} sub={sub} brand={brand} darkMode={darkMode} />
            <PasswordSection email={currentUser?.email} inputCls={inputCls} sub={sub} brand={brand} />
            <DeleteAccountSection onDeleted={onSignOut} onBusyChange={setDeleting} />
          </div>
        ) : view === 'exams' ? (
          /* ── Previous exams — tap one to review it ─────────────────── */
          <div className="p-5">
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No exams yet — start one to see it here.</p>
            ) : (
              <div className="space-y-1">
                {history.map((h) => {
                  const reviewable = Array.isArray(h.detail) && h.detail.length > 0
                  const color = h.score >= 70 ? '#16a34a' : h.score >= 50 ? '#d97706' : '#dc2626'
                  const bar = h.score >= 70 ? '#22c55e' : h.score >= 50 ? '#f59e0b' : '#ef4444'
                  const inner = (
                    <>
                      <span className="text-sm font-bold w-11 text-right flex-shrink-0" style={{ color }}>{h.score}%</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="capitalize truncate">{h.source}</span>
                          <span>•</span>
                          <span className="whitespace-nowrap">{h.correct}/{h.totalQuestions}</span>
                          <span>•</span>
                          <span className="capitalize">{h.mode}</span>
                        </div>
                        <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${h.score}%`, backgroundColor: bar }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">{new Date(h.date).toLocaleDateString()}</span>
                    </>
                  )
                  return reviewable ? (
                    <button
                      key={h.id}
                      onClick={() => setSelectedExam(h)}
                      className="w-full flex items-center gap-2.5 text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition"
                      title="Review this exam"
                    >
                      {inner}
                      <ChevronRight size={14} className="text-gray-400 flex-shrink-0 -ml-1" />
                    </button>
                  ) : (
                    <div key={h.id} className="flex items-center gap-2.5 p-2 opacity-90" title="Summary only — taken before exam review was added">
                      {inner}
                      <span className="w-3.5 flex-shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : view === 'settings' ? (
          /* ── Settings & data ───────────────────────────────────────── */
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onExport} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition ${darkMode ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}><Download size={15} /> Export progress</button>
              <RefreshButton darkMode={darkMode} />
            </div>
            <RemindersToggle darkMode={darkMode} />
            {/* Offline access — pre-download all clinical images */}
            <OfflineDownload imageUrls={imageUrls} darkMode={darkMode} />
          </div>
        ) : (
          /* ── Hub: profile + menu (tap a row to open its page) ───────── */
          <>
            {/* Profile header */}
            <div className="p-6 pb-5 text-center border-b border-gray-100 dark:border-gray-700">
              <div
                className="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ backgroundColor: brand }}
              >
                {initial}
              </div>
              <h2 id="account-modal-title" className="text-lg font-bold tracking-tight" style={{ color: darkMode ? '#7fb5b5' : brand }}>{name}</h2>
              {currentUser?.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                  <Mail size={11} /> {currentUser.email}
                </p>
              )}
              {joined && (
                <p className="text-[11px] text-gray-400 mt-1 flex items-center justify-center gap-1">
                  <CalendarDays size={11} /> Joined {joined}
                </p>
              )}
            </div>

            <div className="p-4 space-y-3">
              <SolvedBadge
                optIn={!!settings?.leaderboardOptIn}
                onJoin={onSettings ? () => onSettings({ leaderboardOptIn: true }) : null}
                solvedCount={solvedCount}
                darkMode={darkMode}
              />

              {/* Menu — each row opens its own page */}
              <div className="space-y-2">
                <NavRow icon={User} label="Account details" desc="Email, mobile number, password" onClick={() => setView('account')} darkMode={darkMode} brand={brand} sub={sub} />
                <NavRow icon={Trophy} label="Previous exams" desc="Review your past exams" badge={history.length} onClick={() => setView('exams')} darkMode={darkMode} brand={brand} sub={sub} />
                <NavRow icon={Settings} label="Settings & data" desc="Export, reminders, offline images" onClick={() => setView('settings')} darkMode={darkMode} brand={brand} sub={sub} />
              </div>

              {onSignOut && (
                <button
                  onClick={() => { if (confirm('Sign out?')) onSignOut() }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition border border-red-200 dark:border-red-900/40"
                >
                  <LogOut size={15} /> Sign out
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Hub navigation row ────────────────────────────────────────────────
// A tappable menu entry on the account hub: icon + label + one-line
// description, with a chevron. Opens one of the panel's sub-pages.
function NavRow({ icon: Icon, label, desc, badge, onClick, darkMode, brand, sub }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition ${sub} ${darkMode ? 'hover:bg-gray-700/60' : 'hover:bg-gray-100'}`}
    >
      <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: darkMode ? 'rgba(127,181,181,0.15)' : 'rgba(44,62,63,0.08)' }}>
        <Icon size={18} style={{ color: darkMode ? '#7fb5b5' : brand }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-[11px] text-gray-500 dark:text-gray-400 truncate">{desc}</span>}
      </span>
      {badge != null && badge !== '' && (
        <span className="text-[11px] font-medium text-gray-400 flex-shrink-0">{badge}</span>
      )}
      <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
    </button>
  )
}

// ── Delete account ────────────────────────────────────────────────────
// Required by App Store Guideline 5.1.1(v): account creation ⇒ in-app
// deletion. Two-step (reveal → confirm) because it is permanent and wipes
// every row the user owns (the delete_my_account RPC cascades server-side).
function DeleteAccountSection({ onDeleted, onBusyChange }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const run = async () => {
    setBusy(true); setErr(''); onBusyChange?.(true)   // locks the drawer while deleting
    try {
      await deleteAccount()
      if (onDeleted) onDeleted()
      else window.location.reload()   // fall back to a clean reload → login
    } catch (e) {
      setBusy(false); onBusyChange?.(false)
      setErr(e?.message || 'Could not delete your account. Please try again.')
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition border border-red-200 dark:border-red-900/40"
      >
        <Trash2 size={15} /> Delete account
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
      <p className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
        <AlertCircle size={15} /> Delete your account?
      </p>
      <p className="text-[11px] text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed">
        This permanently deletes your account and <b>all</b> of your data — quiz
        history, progress, notes, highlights, and flashcards. This cannot be undone.
      </p>
      {err && (
        <p className="text-[11px] text-red-600 mt-2 flex items-start gap-1">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />{err}
        </p>
      )}
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => { setConfirming(false); setErr('') }}
          disabled={busy}
          className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={run}
          disabled={busy}
          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {busy ? 'Deleting…' : 'Permanently delete'}
        </button>
      </div>
    </div>
  )
}

// ── "Most Solved" badge ───────────────────────────────────────────────
// Competitive, encouraging standing derived purely from the existing
// weekly `leaderboard` RPC (questions answered in the last 7 days) — no
// backend changes. Shows the student's rank, with a medal for the top 3
// and a nudge toward the next place for everyone else.
function SolvedBadge({ optIn, onJoin, solvedCount = 0, darkMode }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!optIn) { setRows(null); return }
    let alive = true
    fetchLeaderboard().then((r) => { if (alive) setRows(Array.isArray(r) ? r : []) })
    return () => { alive = false }
  }, [optIn])

  const brand = '#2c3e3f'
  const base = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-amber-50 border-amber-200'

  // Not on the weekly board yet — invite them to compete.
  if (!optIn) {
    return (
      <div className={`rounded-xl border p-4 text-center ${base}`}>
        <Medal size={22} className="mx-auto mb-1" style={{ color: '#c9a84c' }} />
        <p className="text-sm font-semibold">Compete for “Most Solved”</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 mb-2">
          {solvedCount > 0 ? `You've solved ${solvedCount.toLocaleString()} questions so far — see how you rank against classmates.` : 'Join the weekly board and climb the ranking.'}
        </p>
        {onJoin && (
          <button onClick={onJoin} className="text-xs font-semibold text-white px-4 py-1.5 rounded-lg transition hover:opacity-90" style={{ backgroundColor: brand }}>
            Join the weekly board
          </button>
        )}
      </div>
    )
  }

  if (rows === null) {
    return <div className={`rounded-xl border p-4 flex justify-center ${base}`}><Loader2 size={16} className="animate-spin text-gray-400" /></div>
  }

  const meIdx = rows.findIndex((r) => r.is_me)
  const rank = meIdx >= 0 ? meIdx + 1 : null
  const total = rows.length
  const myCount = meIdx >= 0 ? Number(rows[meIdx].answered_7d) : 0

  // Opted in but nothing answered this week yet.
  if (rank === null || myCount === 0) {
    return (
      <div className={`rounded-xl border p-4 text-center ${base}`}>
        <Medal size={22} className="mx-auto mb-1" style={{ color: '#c9a84c' }} />
        <p className="text-sm font-semibold">Most Solved · this week</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Answer a few questions this week to join the ranking.</p>
      </div>
    )
  }

  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎯'
  const nextUp = rank > 1 ? Number(rows[rank - 2].answered_7d) - myCount + 1 : 0
  const top = rank === 1
  const wrap = top
    ? (darkMode ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-300')
    : base
  const headline = top ? '#1 Most Solved — you’re leading the class!' : `#${rank} of ${total} · Most Solved this week`
  const subline = top
    ? `${myCount.toLocaleString()} questions solved in the last 7 days. Keep it up!`
    : `${myCount.toLocaleString()} solved this week · ${Math.max(nextUp, 1)} more to pass #${rank - 1}`

  return (
    <div className={`rounded-xl border p-4 text-center ${wrap}`}>
      <div className="text-2xl mb-0.5" aria-hidden="true">{medal}</div>
      <p className="text-sm font-bold" style={{ color: darkMode ? '#d4b966' : '#b8860b' }}>{headline}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subline}</p>
    </div>
  )
}

// ── Reusable status line ──────────────────────────────────────────────
function Status({ state, msg }) {
  if (!msg) return null
  const ok = state === 'success'
  return (
    <p className={`text-[11px] mt-2 flex items-start gap-1 ${ok ? 'text-green-600' : 'text-red-500'}`}>
      {ok ? <Check size={12} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />}
      <span>{msg}</span>
    </p>
  )
}

function btnStyle(brand, busy) {
  return {
    backgroundColor: brand,
    opacity: busy ? 0.6 : 1,
  }
}

// ── Email ─────────────────────────────────────────────────────────────
function EmailSection({ currentEmail, inputCls, sub, brand }) {
  const [email, setEmail] = useState(currentEmail || '')
  const [state, setState] = useState('idle') // idle | busy | success | error
  const [msg, setMsg] = useState('')

  const save = async () => {
    if (!email || email === currentEmail) { setState('error'); setMsg('Enter a new email address.'); return }
    setState('busy'); setMsg('')
    try {
      await updateEmail(email)
      setState('success'); setMsg(`Confirmation sent to ${email}. Click the link in that email to finish the change.`)
    } catch (e) { setState('error'); setMsg(e.message || 'Could not update email.') }
  }

  return (
    <div className={`rounded-xl border p-4 ${sub}`}>
      <label className="flex items-center gap-2 text-sm font-semibold mb-2"><Mail size={15} style={{ color: brand }} /> Email</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@example.com" autoComplete="email" />
      <button onClick={save} disabled={state === 'busy'} className="mt-2 w-full py-2 rounded-lg text-white text-sm font-medium transition hover:opacity-90" style={btnStyle(brand, state === 'busy')}>
        {state === 'busy' ? 'Sending…' : 'Update email'}
      </button>
      <Status state={state} msg={msg} />
    </div>
  )
}

// ── Mobile number ─────────────────────────────────────────────────────
function PhoneSection({ currentPhone, inputCls, sub, brand, darkMode }) {
  const [phone, setPhone] = useState(currentPhone ? (currentPhone.startsWith('+') ? currentPhone : `+${currentPhone}`) : '')
  const [code, setCode] = useState('')
  const [stage, setStage] = useState('input') // input | verify
  const [state, setState] = useState('idle')
  const [msg, setMsg] = useState('')
  const [pendingPhone, setPendingPhone] = useState('')

  const send = async () => {
    if (currentPhone && normalizePhone(phone) === normalizePhone(currentPhone)) {
      setState('error'); setMsg('Enter a different mobile number.'); return
    }
    setState('busy'); setMsg('')
    try {
      const { phone: normalized } = await startPhoneChange(phone)
      setPendingPhone(normalized); setStage('verify'); setState('idle')
      setMsg(`Code sent to ${normalized}.`)
    } catch (e) { setState('error'); setMsg(e.message || 'Could not send code.') }
  }
  const verify = async () => {
    setState('busy'); setMsg('')
    try {
      await confirmPhoneChange(pendingPhone, code.trim())
      setState('success'); setMsg('Mobile number updated.'); setStage('input')
    } catch (e) { setState('error'); setMsg(e.message || 'Invalid or expired code.') }
  }

  return (
    <div className={`rounded-xl border p-4 ${sub}`}>
      <label className="flex items-center gap-2 text-sm font-semibold mb-2"><Phone size={15} style={{ color: brand }} /> Mobile number</label>
      {stage === 'input' ? (
        <>
          <PhoneInput value={phone} onChange={setPhone} darkMode={darkMode} />
          <button onClick={send} disabled={state === 'busy'} className="mt-2 w-full py-2 rounded-lg text-white text-sm font-medium transition hover:opacity-90" style={btnStyle(brand, state === 'busy')}>
            {state === 'busy' ? 'Sending…' : 'Send verification code'}
          </button>
        </>
      ) : (
        <>
          <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => { setStage('input'); setMsg(''); setState('idle') }} className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600">Back</button>
            <button onClick={verify} disabled={state === 'busy'} className="flex-1 py-2 rounded-lg text-white text-sm font-medium transition hover:opacity-90" style={btnStyle(brand, state === 'busy')}>
              {state === 'busy' ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </>
      )}
      <Status state={state} msg={msg} />
    </div>
  )
}

// ── Password ──────────────────────────────────────────────────────────
function PasswordSection({ email, inputCls, sub, brand }) {
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [state, setState] = useState('idle')
  const [msg, setMsg] = useState('')

  const save = async () => {
    if (pw !== pw2) { setState('error'); setMsg('New passwords do not match.'); return }
    setState('busy'); setMsg('')
    try {
      await updatePassword({ email, currentPassword: current, newPassword: pw })
      setState('success'); setMsg('Password changed.'); setCurrent(''); setPw(''); setPw2('')
    } catch (e) { setState('error'); setMsg(e.message || 'Could not change password.') }
  }

  return (
    <div className={`rounded-xl border p-4 ${sub}`}>
      <label className="flex items-center gap-2 text-sm font-semibold mb-2"><Lock size={15} style={{ color: brand }} /> Password</label>
      <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} placeholder="Current password" autoComplete="current-password" />
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${inputCls} mt-2`} placeholder="New password" autoComplete="new-password" />
      <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={`${inputCls} mt-2`} placeholder="Confirm new password" autoComplete="new-password" />
      <button onClick={save} disabled={state === 'busy'} className="mt-2 w-full py-2 rounded-lg text-white text-sm font-medium transition hover:opacity-90" style={btnStyle(brand, state === 'busy')}>
        {state === 'busy' ? 'Saving…' : 'Change password'}
      </button>
      <Status state={state} msg={msg} />
    </div>
  )
}
