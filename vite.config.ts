import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  server: {
    port: 1337,
  },
  plugins: [
    preact(),
    tailwindcss(),
    VitePWA({
      // autoUpdate is safe here: the app has no lazy chunks, so a mid-session
      // SW swap can't 404 stale assets. New versions apply on next launch.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: '/',
        name: 'Titan Fitness',
        short_name: 'Titan',
        description: 'AI-powered home gym fitness coach',
        theme_color: '#102217',
        background_color: '#102217',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Start Workout', url: '/', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'AI Coach', url: '/coach', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Progress', url: '/progress', icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // iOS fetches startup images outside the SW; don't bloat the precache
        globIgnores: ['**/splash/**'],
        runtimeCaching: [
          {
            // Discover/Home hero images — cache after first view so they
            // work offline (they're excluded from precache by size)
            urlPattern: /\/images\/.*\.(?:jpg|jpeg|webp)$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'app-images', expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
          {
            // Font CSS can change per UA — revalidate in the background
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // Font binaries are immutable
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-files', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
});
