import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import {
  signUp, signInWithUsername, requestPasswordReset,
  validateUsername, validateEmail, validatePassword,
} from '../lib/auth'

const brand = '#2c3e3f'
const gold = '#c9a84c'

// Mode: 'login' | 'register' | 'forgot'
export default function AuthScreen({ darkMode, onToggleDark }) {
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // Form fields (shared across modes)
  const [usernameOrEmail, setUsernameOrEmail] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const clear = () => { setError(''); setInfo('') }
  const switchTo = (m) => { clear(); setMode(m) }

  async function handleSubmit(e) {
    e.preventDefault()
    clear()
    setBusy(true)
    try {
      if (mode === 'login') {
        await signInWithUsername({ usernameOrEmail, password })
        // Auth state listener in App.jsx will re-render us out.
      } else if (mode === 'register') {
        // Validate up front so we can show inline errors
        const errs = [validateUsername(username), validateEmail(email), validatePassword(password)].filter(Boolean)
        if (errs.length) throw new Error(errs[0])
        await signUp({ email, username, password })
        setInfo('Account created! Check your email to confirm and then sign in.')
        setMode('login')
      } else if (mode === 'forgot') {
        await requestPasswordReset(email)
        setInfo('If that email is registered, a reset link is on its way.')
      }
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
        {/* Header */}
        <h2 className="text-xl font-bold mb-1" style={{ color: darkMode ? '#7fb5b5' : brand }}>
          {mode === 'login' && 'Sign in'}
          {mode === 'register' && 'Create your account'}
          {mode === 'forgot' && 'Reset your password'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          {mode === 'login' && 'Welcome back. Pick up where you left off.'}
          {mode === 'register' && 'Track your progress across every device.'}
          {mode === 'forgot' && 'Enter your email and we’ll send you a reset link.'}
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

          {mode === 'login' && (
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

          {mode === 'register' && (
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

          {mode === 'forgot' && (
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

          {(mode === 'login' || mode === 'register') && (
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
                {mode === 'login' && 'Sign in'}
                {mode === 'register' && 'Create account'}
                {mode === 'forgot' && 'Send reset link'}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Mode switcher */}
        <div className="mt-5 pt-4 border-t dark:border-gray-700 text-xs text-center text-gray-500 dark:text-gray-400 space-y-1.5">
          {mode === 'login' && (
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
          {mode === 'register' && (
            <p>
              Already have an account?{' '}
              <button onClick={() => switchTo('login')} className="font-semibold underline hover:opacity-70" style={{ color: brand }}>
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              Remembered it?{' '}
              <button onClick={() => switchTo('login')} className="font-semibold underline hover:opacity-70" style={{ color: brand }}>
                Back to sign in
              </button>
            </p>
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
  return msg
}
