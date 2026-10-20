import { Capacitor } from '@capacitor/core'

// Native daily study reminders via on-device local notifications. No server,
// no APNs/FCM — the OS fires a repeating notification at the chosen time.
// Used by the native apps; the web keeps its Web Push reminders (see push.js).

const REMINDER_ID = 1001
const PREF_KEY = 'skinscript-local-reminder' // { enabled, hour, minute }

export function nativeRemindersSupported() {
  return Capacitor.isNativePlatform()
}

export function getReminderPref() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || 'null')
    if (p && typeof p.hour === 'number') return p
  } catch { /* ignore */ }
  return { enabled: false, hour: 18, minute: 0 }
}

function setReminderPref(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

// A short, evergreen nudge — a daily repeating notification keeps the same body,
// so it must read well every day (no stale "3 reviews due" counts).
const BODY = 'Time for today’s dermatology practice — keep your streak alive. 🧠'

// (Re)schedule the daily reminder. Returns true on success.
export async function enableLocalReminder(hour = 18, minute = 0) {
  if (!Capacitor.isNativePlatform()) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') throw new Error('denied')
  // Clear any existing schedule first so changing the time doesn't duplicate.
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {})
  await LocalNotifications.schedule({
    notifications: [{
      id: REMINDER_ID,
      title: 'SkinScript',
      body: BODY,
      // `on` with hour/minute fires every day at that local time.
      schedule: { on: { hour, minute }, allowWhileIdle: true },
    }],
  })
  setReminderPref({ enabled: true, hour, minute })
  return true
}

export async function disableLocalReminder() {
  if (!Capacitor.isNativePlatform()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {})
  const pref = getReminderPref()
  setReminderPref({ ...pref, enabled: false })
}

// Keep the OS schedule in sync with the saved preference on app start — e.g.
// re-arm it after an app update clears pending notifications. Safe to call on
// every launch; no-op on web or when reminders are off.
export async function syncLocalReminder() {
  if (!Capacitor.isNativePlatform()) return
  const pref = getReminderPref()
  if (!pref.enabled) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.checkPermissions()
    if (perm.display !== 'granted') return
    const pending = await LocalNotifications.getPending()
    const already = pending?.notifications?.some((n) => n.id === REMINDER_ID)
    if (already) return
    await LocalNotifications.schedule({
      notifications: [{
        id: REMINDER_ID,
        title: 'SkinScript',
        body: BODY,
        schedule: { on: { hour: pref.hour, minute: pref.minute }, allowWhileIdle: true },
      }],
    })
  } catch { /* ignore */ }
}
