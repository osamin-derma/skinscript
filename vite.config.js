import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Served from the custom apex domain https://osamah.co/ — root base path.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    // ── Progressive Web App: install-to-home-screen + offline cache ────
    // Generates a service worker (Workbox) + manifest at build time.
    // Auto-updates the running app when a new deploy lands; users see a
    // toast prompt to refresh.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.png', 'favicon.svg', 'apple-touch-icon.png', 'icon.png',
      ],
      manifest: {
        id: '/?source=pwa',
        name: 'SkinScript — Dermatology Board Prep',
        short_name: 'SkinScript',
        description: 'Dermatology board prep · 11,896 verified questions across Arab Board, Board Vitals, Makki, and ETAS 2026. By Dr. Osama Al Rawi.',
        theme_color: '#2c3e3f',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        categories: ['education', 'medical'],
      },
      workbox: {
        // The data JSON files for the question banks are big — raise the
        // pre-cache size cap so the build doesn't refuse them.
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,    // 20 MB
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,woff2,json}'],

        runtimeCaching: [
          // 1. Question images on Supabase Storage — cache-first, save
          //    each photo the first time it's viewed so the next quiz
          //    works offline.
          {
            urlPattern: /^https:\/\/yssrtjfgkctojkzcoapt\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'question-images',
              expiration: {
                maxEntries: 1500,            // a bit above our 1,077 total
                maxAgeSeconds: 60 * 60 * 24 * 90,    // 90 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 2. Google Fonts CSS — stale-while-revalidate so the UI font
          //    appears instantly on repeat visits.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          // 3. Google Fonts files — long-lived cache; they have hashed URLs.
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 4. Supabase Auth + REST — NETWORK ONLY. Caching auth tokens
          //    or row data would be a correctness disaster.
          {
            urlPattern: /^https:\/\/yssrtjfgkctojkzcoapt\.supabase\.co\/(auth|rest|rpc)\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  base: '/',
})
