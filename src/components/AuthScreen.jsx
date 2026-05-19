import { useState } from 'react'
import {
  Eye, EyeOff, Mail, Lock, User, MessageSquare,
  ArrowRight, AlertCircle, CheckCircle2,
} from 'lucide-react'
import {
  signUp, signInWithUsername, requestPasswordReset,
  validateUsername, validateEmail, validatePassword,
  sendSmsOtp, verifySmsOtp,
} from '../lib/auth'
import PhoneInput from './PhoneInput'

const brand = '#2c3e3f'
const gold = '#c9a84c'

// method: 'email' | 'sms'
// mode (email): 'login' | 'register' | 'forgot'
// mode (sms):   'phone' (ask for number) | 'code' (enter OTP)
export default function AuthScreen({ darkMode, onToggleDark }) {
  const [method, setMethod] = useState('email')
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Email-flow fields
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  // SMS / phone-flow fields
  const [phone, setPhone] = useState('')
  const [smsUsername, setSmsUsername] = useState('')
  const [otp, setOtp] = useState('')
  const [verifiedPhone, setVerifiedPhone] = useState('')   // server-normalized

  const clear = () => { setError(''); setInfo('') }
  const switchTo = (m) => { clear(); setMode(m) }
  const switchMethod = (m) => {
    clear()
    setMethod(m)
    setMode(m === 'email' ? 'login' : 'phone')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    clear()
    setBusy(true)
    try {
      // ── Email / username flows ──
      if (method === 'email' && mode === 'login') {
        await signInWithUsername({ usernameOrEmail, password })
      } else if (method === 'email' && mode === 'register') {
        const errs = [validateUsername(username), validateEmail(email), validatePassword(password)].filter(Boolean)
        if (errs.length) throw new Error(errs[0])
        await signUp({ email, username, password })
        setInfo('Account created! Check your email to confirm and then sign in.')
        setMode('login')
      } else if (method === 'email' && mode === 'forgot') {
        await requestPasswordReset(email)
        setInfo('If that email is registered, a reset link is on its way.')
      }

      // ── SMS OTP flow ──
      else if (method === 'sms' && mode === 'phone') {
        const { phone: normalized } = await sendSmsOtp({ phone, username: smsUsername })
        setVerifiedPhone(normalized)
        setMode('code')
        setInfo(`We sent a 6-digit code to ${normalized} by SMS.`)
      } else if (method === 'sms' && mode === 'code') {
        await verifySmsOtp({ phone: verifiedPhone, token: otp })
        // Auth state listener in App.jsx will re-render us out.
      }
    } catch (err) {
      setError(humanizeAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  async function resendCode() {
    clear()
    setBusy(true)
    try {
      await sendSmsOtp({ phone: verifiedPhone, username: smsUsername })
      setInfo(`Re-sent a code to ${verifiedPhone} by SMS.`)
    } catch (err) {
      setError(humanizeAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors ${
      darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'
    }`}>
      {/* Branding */}
      <div className="mb-8 text-center">
        <div className="inline-block px-3 py-1 rounded-full mb-3" style={{ backgroundColor: '#fdf6e3', color: gold }}>
          <span className="text-[10px] font-bold tracking-wider uppercase">Master Edition · 2026</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: darkMode ? '#7fb5b5' : brand }}>
          SkinScript
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Dermatology board prep · 11,896 verified questions
        </p>
      </div>

      <div className={`w-full max-w-md rounded-2xl shadow-2xl p-7 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Method tabs (Email / WhatsApp) */}
        <div className={`flex gap-1 p-1 mb-5 rounded-xl ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <button
            type="button"
            onClick={() => switchMethod('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
              method === 'email'
                ? (darkMode ? 'bg-gray-700 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm')
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            <Mail size={13} /> Email
          </button>
          <button
            type="button"
            onClick={() => switchMethod('sms')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
              method === 'sms'
                ? (darkMode ? 'bg-gray-700 text-gray-100 shadow-sm' : 'bg-white text-gray-800 shadow-sm')
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            <MessageSquare size={13} /> SMS
          </button>
        </div>

        {/* Header */}
        <h2 className="text-xl font-bold mb-1" style={{ color: darkMode ? '#7fb5b5' : brand }}>
          {method === 'email' && mode === 'login'    && 'Sign in'}
          {method === 'email' && mode === 'register' && 'Create your account'}
          {method === 'email' && mode === 'forgot'   && 'Reset your password'}
          {method === 'sms'   && mode === 'phone'    && 'Sign in by SMS'}
          {method === 'sms'   && mode === 'code'     && 'Enter your verification code'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {method === 'email' && mode === 'login'    && 'Welcome back. Pick up where you left off.'}
          {method === 'email' && mode === 'register' && 'Track your progress across every device.'}
          {method === 'email' && mode === 'forgot'   && 'Enter your email and we’ll send you a reset link.'}
          {method === 'sms'   && mode === 'phone'    && 'We’ll text you a 6-digit code.'}
          {method === 'sms'   && mode === 'code'     && `Check your SMS for the code sent to ${verifiedPhone}.`}
        </p>

        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <AlertCircle size={16} className="mt-0.5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{error}</p>
          </div>
        )}
        {info && (
          <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle2 size={16} className="mt-0.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">{info}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {method === 'email' && mode === 'login' && (
            <Field
              icon={<User size={16} />}
              label="Username or email"
              type="text"
              autoComplete="username"
              value={usernameOrEmail}
              onChange={setUsernameOrEmail}
              darkMode={darkMode}
              autoFocus
            />
          )}

          {method === 'email' && mode === 'register' && (
            <>
              <Field
                icon={<User size={16} />}
                label="Username"
                hint="3–24 chars, letters / digits / underscores"
                type="text"
                autoComplete="username"
                value={username}
                onChange={setUsername}
                darkMode={darkMode}
                autoFocus
              />
              <Field
                icon={<Mail size={16} />}
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                darkMode={darkMode}
              />
            </>
          )}

          {method === 'email' && mode === 'forgot' && (
            <Field
              icon={<Mail size={16} />}
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              darkMode={darkMode}
              autoFocus
            />
          )}

          {/* ─── SMS flow ─── */}
          {method === 'sms' && mode === 'phone' && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                  Mobile number
                </label>
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  darkMode={darkMode}
                  autoFocus
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                  Pick your country, then enter the rest of your mobile number.
                </p>
              </div>
              <Field
                icon={<User size={16} />}
                label="Username"
                hint="Pick a username (only needed if you’re new)"
                type="text"
                autoComplete="username"
                value={smsUsername}
                onChange={setSmsUsername}
                darkMode={darkMode}
              />
            </>
          )}

          {method === 'sms' && mode === 'code' && (
            <Field
              icon={<MessageSquare size={16} />}
              label="6-digit code"
              hint="Open Messages and copy the code we just sent"
              type="text"
              autoComplete="one-time-code"
              value={otp}
              onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 8))}
              darkMode={darkMode}
              autoFocus
            />
          )}

          {(method === 'email' && (mode === 'login' || mode === 'register')) && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 focus-within:ring-2 transition ${
                darkMode
                  ? 'bg-gray-900 border-gray-700 focus-within:ring-gray-600'
                  : 'bg-gray-50 border-gray-200 focus-within:ring-gray-300'
              }`}>
                <Lock size={16} className="text-gray-400" />
                <input
                  className="flex-1 bg-transparent outline-none text-sm"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                  Minimum 8 characters.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 hover:opacity-90 shadow"
            style={{ backgroundColor: brand }}
          >
            {busy ? (
              <span className="inline-block animate-pulse">Working…</span>
            ) : (
              <>
                {method === 'email' && mode === 'login'    && 'Sign in'}
                {method === 'email' && mode === 'register' && 'Create account'}
                {method === 'email' && mode === 'forgot'   && 'Send reset link'}
                {method === 'sms'   && mode === 'phone'    && 'Send SMS code'}
                {method === 'sms'   && mode === 'code'     && 'Verify & sign in'}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Mode switcher */}
        <div className="mt-5 pt-4 border-t dark:border-gray-700 text-xs text-center text-gray-500 dark:text-gray-400 space-y-1.5">
          {method === 'email' && mode === 'login' && (
            <>
              <p>
                Don’t have an account?{' '}
                <button onClick={() => switchTo('register')} className="font-semibold underline hover:opacity-70" style={{ color: brand }}>
                  Create one
                </button>
              </p>
              <p>
                <button onClick={() => switchTo('forgot')} className="font-semibold underline hover:opacity-70" style={{ color: brand }}>
                  Forgot password?
                </button>
              </p>
            </>
          )}
          {method === 'email' && mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button onClick={() => switchTo('login')} className="font-semibold underline hover:opacity-70" style={{ color: brand }}>
                Sign in
              </button>
            </p>
          )}
          {method === 'email' && mode === 'forgot' && (
            <p>
              Remembered it?{' '}
              <button onClick={() => switchTo('login')} className="font-semibold underline hover:opacity-70" style={{ color: brand }}>
                Back to sign in
              </button>
            </p>
          )}
          {method === 'sms' && mode === 'code' && (
            <>
              <p>
                Didn’t get the code?{' '}
                <button onClick={resendCode} disabled={busy} className="font-semibold underline hover:opacity-70 disabled:opacity-40" style={{ color: brand }}>
                  Resend
                </button>
              </p>
              <p>
                <button onClick={() => { setMode('phone'); setOtp('') }} className="font-semibold underline hover:opacity-70" style={{ color: brand }}>
                  Change number
                </button>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Dark-mode toggle pinned bottom */}
      <button
        onClick={onToggleDark}
        className="mt-6 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 underline"
      >
        {darkMode ? 'Light mode' : 'Dark mode'}
      </button>
    </div>
  )
}


function Field({ icon, label, hint, type, value, onChange, autoComplete, autoFocus, darkMode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 focus-within:ring-2 transition ${
        darkMode
          ? 'bg-gray-900 border-gray-700 focus-within:ring-gray-600'
          : 'bg-gray-50 border-gray-200 focus-within:ring-gray-300'
      }`}>
        <span className="text-gray-400">{icon}</span>
        <input
          className="flex-1 bg-transparent outline-none text-sm"
          type={type}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>
      {hint && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">{hint}</p>}
    </div>
  )
}


function humanizeAuthError(err) {
  const msg = err?.message || String(err)
  if (/Invalid login credentials/i.test(msg)) return 'Username/email or password is incorrect.'
  if (/User already registered/i.test(msg)) return 'An account with that email already exists.'
  if (/already been registered/i.test(msg)) return 'An account with that email already exists.'
  if (/Email rate limit/i.test(msg)) return 'Too many emails sent. Please wait a few minutes and try again.'
  if (/Email not confirmed/i.test(msg)) return 'Please confirm your email first — check your inbox.'

  // Twilio / Verify
  if (/Token has expired|expired/i.test(msg)) return 'That code expired — request a new one.'
  if (/Invalid token|Token is invalid|incorrect/i.test(msg)) return 'Wrong code. Double-check the message and try again.'
  if (/Phone.*already.*registered/i.test(msg)) return 'That phone number is already linked to an account.'
  if (/SMS rate limit|exceeded the rate limit|rate.limit/i.test(msg)) return 'Too many code requests. Wait a minute and try again.'
  if (/Unverified number|unverified number/i.test(msg)) return 'Your number isn’t on our SMS sender’s allow-list yet — the admin needs to verify it first (Twilio trial-mode limit).'
  if (/not a valid phone number|invalid phone/i.test(msg)) return 'That doesn’t look like a valid phone number.'

  return msg
}
