import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────
// Auth helpers
//
// Users sign in with a *username* + password, but Supabase Auth itself only
// understands email + password.  We bridge by:
//
//   - Registration: creates an auth user with the email AND immediately
//     inserts a row in `profiles` linking the username to that user_id.
//     The Postgres trigger in supabase/schema.sql copies the username from
//     auth metadata if the insert is skipped.
//
//   - Login: if the input contains "@", treat as email; otherwise look up
//     the email matching that username via the `usernames_lookup` RPC and
//     call signInWithPassword with the resolved email.
// ─────────────────────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateUsername(u) {
  if (!u) return 'Username is required.'
  if (!USERNAME_RE.test(u)) {
    return 'Username must be 3–24 characters, letters / digits / underscores only.'
  }
  return null
}

export function validateEmail(e) {
  if (!e) return 'Email is required.'
  if (!EMAIL_RE.test(e)) return 'That doesn’t look like a valid email.'
  return null
}

export function validatePassword(p) {
  if (!p) return 'Password is required.'
  if (p.length < 8) return 'Password must be at least 8 characters.'
  return null
}


export async function signUp({ email, username, password, displayName }) {
  const ue = validateUsername(username)
  if (ue) throw new Error(ue)
  const ee = validateEmail(email)
  if (ee) throw new Error(ee)
  const pe = validatePassword(password)
  if (pe) throw new Error(pe)

  // Check username availability before creating an auth account, so a
  // duplicate name doesn't leave an orphan user_id behind.
  const { data: existing, error: lookupErr } = await supabase
    .rpc('username_taken', { p_username: username })
  if (lookupErr) throw lookupErr
  if (existing) throw new Error('That username is already taken.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The profiles auto-insert trigger reads username from raw_user_meta_data.
      data: {
        username,
        display_name: displayName || username,
      },
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) throw error
  return data
}


export async function signInWithUsername({ usernameOrEmail, password }) {
  if (!usernameOrEmail) throw new Error('Username or email is required.')
  if (!password) throw new Error('Password is required.')

  let email = usernameOrEmail.trim()

  // If it's not already an email, resolve the username → email via RPC.
  if (!email.includes('@')) {
    const { data, error } = await supabase
      .rpc('email_for_username', { p_username: email })
    if (error) throw error
    if (!data) throw new Error('No account found with that username.')
    email = data
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}


export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}


export async function requestPasswordReset(email) {
  const ee = validateEmail(email)
  if (ee) throw new Error(ee)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  if (error) throw error
}


// React hook-ish helper: returns the current session synchronously from
// localStorage (Supabase persists it) so the app doesn't flash the auth
// screen on every refresh while the network call resolves.
export function getCurrentSession() {
  return supabase.auth.getSession()
}

export function onAuthStateChange(cb) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => {
    cb(session)
  })
  return () => subscription.unsubscribe()
}
