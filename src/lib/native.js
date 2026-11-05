import { Capacitor } from '@capacitor/core'
import { syncLocalReminder } from './localReminders'

// One-time native-shell setup. No-op on the web.
// The app's top controls (account chip, dark-mode / sign-out, the quiz header)
// are kept clear of the status bar / Dynamic Island by the CSS safe-area insets
// (env(safe-area-inset-*) on <body>). On iOS the WebView therefore overlays the
// status bar so the app background fills behind it — otherwise iOS paints that
// region solid black. Android keeps the WebView below the status bar.
export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // iOS: overlay so the light app background shows behind the status bar
    // (content is held clear of the island by the body's safe-area padding).
    const overlay = Capacitor.getPlatform() === 'ios'
    await StatusBar.setOverlaysWebView({ overlay })
    // App background is light → dark status-bar text.
    await StatusBar.setStyle({ style: Style.Light })
  } catch { /* status-bar plugin unavailable — ignore */ }
  // Re-arm the daily study reminder if the user had it on.
  syncLocalReminder()
}
