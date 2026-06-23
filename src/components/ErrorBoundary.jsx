import { Component } from 'react'

/**
 * Catches any render-time crash anywhere in the tree and shows a friendly
 * recovery screen instead of a white page. The "Reload" button also clears
 * the PWA cache + unregisters the service worker, so a user stuck on a
 * stale/broken cached bundle gets a fresh copy on the next load.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || String(err) }
  }

  componentDidCatch(err, info) {
    console.error('[ErrorBoundary]', err, info)
  }

  async hardReload() {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {/* ignore */}
    // Cache-busting reload to bypass any stale HTML.
    window.location.replace(window.location.pathname + '?_r=' + Date.now())
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
        <div className="max-w-sm w-full text-center">
          <div className="text-4xl mb-3">🩹</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#2c3e3f' }}>
            Something went wrong
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
            The page hit an unexpected error. Reloading fetches the latest
            version and usually fixes it.
          </p>
          <button
            onClick={() => this.hardReload()}
            className="w-full py-3 rounded-xl text-white font-bold text-sm transition hover:opacity-90 shadow"
            style={{ backgroundColor: '#2c3e3f' }}
          >
            Reload the app
          </button>
          {this.state.message && (
            <p className="mt-4 text-[10px] text-gray-400 break-words font-mono">
              {this.state.message}
            </p>
          )}
        </div>
      </div>
    )
  }
}
