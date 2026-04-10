import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'MealOps',
        short_name: 'MealOps',
        description: 'Planificador semanal de alimentación BLW para bebés y familia',
        theme_color: '#16a34a',
        background_color: '#f2f1f0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Cache app shell + static assets (cache-first via precaching)
        globPatterns: ['**/*.{js,css,html,svg,ico,woff,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // Don't cache Anthropic API or Firebase SDK network calls
        navigateFallbackDenylist: [/^\/__/, /\/api\//],
        runtimeCaching: [
          // Google Fonts stylesheets — cache-first, long TTL
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mealops-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Google Fonts webfonts — cache-first, long TTL
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mealops-fonts-webfonts',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          // Netlify Functions (our Express-style backend) — network-first
          {
            urlPattern: /\/\.netlify\/functions\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'mealops-api',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Do NOT add rules for api.anthropic.com or Firebase — let those pass through
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'react-vendor': ['react', 'react-dom'],
          'dnd-kit': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
})
