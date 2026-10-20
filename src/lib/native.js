import { Capacitor } from '@capacitor/core'
import { syncLocalReminder } from './localReminders'

// One-time native-shell setup. No-op on the web.
// Keeps the WebView content below the iOS/Android status bar so the app's own
// top bar (account chip, dark-mode / sign-out, the quiz header) isn't hidden
// behind it — without that, those controls are unreachable on a real device.
export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: false })
    // App background is light → dark status-bar text.
    await StatusBar.setStyle({ style: Style.Light })
  } catch { /* status-bar plugin unavailable — ignore */ }
  // Re-arm the daily study reminder if the user had it on.
  syncLocalReminder()
}
