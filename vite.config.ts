
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'RouteReady',
        short_name: 'RouteReady',
        description: 'Offline Istanbul public transport and navigation',
        theme_color: '#863bff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
  {
    src: '/routeready-icon.png',
    sizes: '512x512',
    type: 'image/png',
  },
],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    https: {
      key: readFileSync('.certs/routeready-key.pem'),
      cert: readFileSync('.certs/routeready.pem'),
    },
  },
});
