import { useState, useEffect, useRef } from 'react'
import { X, Mail, Phone, Lock, Trophy, User, CalendarDays, Check, AlertCircle, LogOut } from 'lucide-react'
import PhoneInput from './PhoneInput'
import { updateEmail, updatePassword, startPhoneChange, confirmPhoneChange, normalizePhone } from '../lib/auth'

/**
 * Account panel — opened by clicking the username chip on the StartScreen.
 *
 * Shows the user's name, email, and join date, lets them change their email,
 * mobile number, and password (each through the proper Supabase flow:
 * email + phone require confirmation, password is immediate), and lists their
 * recent quizzes.
 */
export default function AccountModal({ currentUser, history = [], darkMode, onClose, onSignOut }) {
  const brand = '#2c3e3f'
  const closeRef = useRef(null)

  // Close on Escape; move focus into the dialog on open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const name = currentUser?.username || (currentUser?.email || '').split('@')[0] || 'You'
  const initial = (name[0] || 'U').toUpperCase()
  const joined = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  const sub = darkMode ? 'bg-gray-900/40 border-gray-700' : 'bg-gray-50 border-gray-200'
  const inputCls = `w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 ${
    darkMode ? 'bg-gray-900 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'
  }`

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div
        className={`relative w-full max-w-md rounded-2xl border shadow-2xl ${card} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
          aria-label="Close"
        >
          <X size={18} />
        </button>

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

        <div className="p-5 space-y-4">
          <EmailSection currentEmail={currentUser?.email} inputCls={inputCls} sub={sub} brand={brand} />
          <PhoneSection currentPhone={currentUser?.phone} inputCls={inputCls} sub={sub} brand={brand} darkMode={darkMode} />
          <PasswordSection email={currentUser?.email} inputCls={inputCls} sub={sub} brand={brand} />

          {/* Previous quizzes */}
          <div className={`rounded-xl border p-4 ${sub}`}>
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={15} style={{ color: brand }} />
              <span className="text-sm font-semibold">Previous quizzes</span>
              <span className="ml-auto text-[11px] text-gray-400">{history.length} total</span>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No quizzes yet — start one to see it here.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 6).map((h) => (
                  <div key={h.id} className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold w-12 text-right"
                      style={{ color: h.score >= 70 ? '#16a34a' : h.score >= 50 ? '#d97706' : '#dc2626' }}
                    >
                      {h.score}%
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="capitalize truncate">{h.source}</span>
                        <span>•</span>
                        <span>{h.correct}/{h.totalQuestions}</span>
                        <span>•</span>
                        <span className="capitalize">{h.mode}</span>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${h.score}%`, backgroundColor: h.score >= 70 ? '#22c55e' : h.score >= 50 ? '#f59e0b' : '#ef4444' }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(h.date).toLocaleDateString()}</span>
                  </div>
                ))}
                {history.length > 6 && (
                  <p className="text-[10px] text-gray-400 text-center pt-1">+ {history.length - 6} more in the History tab</p>
                )}
              </div>
            )}
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
      </div>
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
