import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────
// Web Push (daily study reminders). The browser subscription is stored in
// public.push_subscriptions; the `push-reminders` edge function (run hourly
// by pg_cron) sends "reviews due / streak at risk" at ~6 pm local time.
// The VAPID public key is public by design; the private half is an edge
// function secret.
// ─────────────────────────────────────────────────────────────────────────
export const VAPID_PUBLIC_KEY = 'BCg7QSFmtYuFu40BeR731gQw1PEAX6o17CnwUQ0T9na5GL5tyhmLxWqHOUUaTnz2LdDsP_lU-Ld9k7F1rGq4x9M'

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
// iOS only allows Web Push for apps installed to the Home Screen (16.4+).
export function iosNeedsInstall() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || navigator.standalone === true
  return ios && !standalone
}
function b64uToU8(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}
async function registration() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('no_sw')
  return reg
}
export async function getPushSubscription() {
  if (!pushSupported()) return null
  try { return await (await registration()).pushManager.getSubscription() } catch { return null }
}
export async function enablePush() {
  if (!pushSupported()) throw new Error('unsupported')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('denied')
  const reg = await registration()
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(VAPID_PUBLIC_KEY) }))
  const j = sub.toJSON()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('signed_out')
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: session.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
    user_agent: (navigator.userAgent || '').slice(0, 200), tz_offset_min: -new Date().getTimezoneOffset(),
  }, { onConflict: 'endpoint' })
  if (error) throw error
  return sub
}
export async function disablePush() {
  const sub = await getPushSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  try { await sub.unsubscribe() } catch { /* ignore */ }
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}
