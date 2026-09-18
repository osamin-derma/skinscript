/* SkinScript — Web Push handlers. Imported into the generated Workbox service
   worker (vite.config.js → workbox.importScripts). Bump ?v= when this changes. */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || 'SkinScript'
  const options = {
    body: data.body || 'You have reviews due today.',
    icon: '/pwa-192.png', badge: '/pwa-192.png',
    tag: data.tag || 'skinscript-reminder', renotify: false,
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) return c.focus() }
    return self.clients.openWindow(url)
  }))
})
