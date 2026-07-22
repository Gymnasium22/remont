import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Для GitHub Pages: VITE_BASE=/repo-name/  (или ./ для relative)
const base = process.env.VITE_BASE || './';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'МойРемонт',
        short_name: 'МойРемонт',
        description:
          'Локальный трекер сметы и расходов на ремонт квартиры (Br)',
        theme_color: '#2563eb',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'portrait-primary',
        lang: 'ru',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
