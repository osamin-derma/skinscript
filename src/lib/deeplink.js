import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

// Custom URL scheme the native apps register (iOS Info.plist + Android
// AndroidManifest). Supabase redirects email links (confirm sign-up, reset
// password, change email, magic link) here so the flow finishes INSIDE the app
// instead of in the phone browser.
export const AUTH_CALLBACK_URL = 'co.osamah.skinscript://auth-callback'

// Where Supabase should send the user after an email link. On the web it's the
// site origin (handled by the client's detectSessionInUrl); on native it's the
// custom-scheme deep link handled by initAuthDeepLinks() below.
export function authRedirectUrl() {
  return Capacitor.isNativePlatform() ? AUTH_CALLBACK_URL : window.location.origin
}

// Pull the session out of a deep-link URL and hand it to Supabase.
// Supports the implicit flow (tokens in the URL fragment, matching the web
// client config) and PKCE (?code=...). Returns the Supabase link `type`
// (e.g. 'signup' | 'recovery' | 'email_change' | 'magiclink') on success.
async function completeFromUrl(url) {
  if (!url) return null
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  const queryStr = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : ''
  const frag = new URLSearchParams(hash)
  const query = new URLSearchParams(queryStr)

  const errDesc = frag.get('error_description') || query.get('error_description')
  if (errDesc) { console.warn('[auth deep-link]', errDesc); return null }

  // Implicit flow — tokens delivered in the fragment.
  const access_token = frag.get('access_token')
  const refresh_token = frag.get('refresh_token')
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) { console.warn('[auth deep-link] setSession', error.message); return null }
    return frag.get('type') || 'session'
  }

  // PKCE flow — exchange the one-time code for a session (code_verifier was
  // stored in localStorage when the email was requested).
  const code = query.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) { console.warn('[auth deep-link] exchangeCode', error.message); return null }
    return query.get('type') || 'session'
  }
  return null
}

// Register native deep-link handling. No-op on the web. `onType(type)` is
// called after a session is established, so the UI can react (e.g. route to a
// "set new password" screen when type === 'recovery'). Returns a cleanup fn.
export function initAuthDeepLinks(onType) {
  if (!Capacitor.isNativePlatform()) return () => {}
  let removeListener = null
  ;(async () => {
    const { App } = await import('@capacitor/app')
    const handle = async (url) => {
      if (!url || !url.includes('auth-callback')) return
      const type = await completeFromUrl(url)
      if (type && typeof onType === 'function') onType(type)
    }
    const sub = await App.addListener('appUrlOpen', (data) => handle(data?.url))
    removeListener = () => sub.remove()
    // Cold start: the app may have been launched by the link.
    try {
      const launch = await App.getLaunchUrl()
      if (launch?.url) handle(launch.url)
    } catch { /* ignore */ }
  })()
  return () => { if (removeListener) removeListener() }
}
