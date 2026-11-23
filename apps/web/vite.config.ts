import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import type { Connect, Plugin } from 'vite';

const CATALOG_OUT = fileURLToPath(new URL('../../packages/catalog/out', import.meta.url));
const TYPES: Record<string, string> = { '.json': 'application/json', '.webp': 'image/webp' };

/** Serves the built catalog (/catalog, /media) in dev and preview, like Caddy does in production. */
function serveCatalog(): Plugin {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url ?? '').split('?')[0]!;
    if (!url.startsWith('/catalog/') && !url.startsWith('/media/')) return next();
    const file = normalize(join(CATALOG_OUT, decodeURIComponent(url)));
    if (!file.startsWith(CATALOG_OUT) || !existsSync(file) || !statSync(file).isFile()) return next();
    res.setHeader('content-type', TYPES[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  };
  return {
    name: 'gym-serve-catalog',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

// The released version (root package.json), shown at the foot of the app.
const APP_VERSION = (JSON.parse(readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8')) as { version: string }).version;

const apiProxy = { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000' };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [
    // Router plugin must run before the React plugin.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    serveCatalog(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      // Never activate a new version by itself: the user (or the end of a workout) decides.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'Gym — Entrena en casa o en el gimnasio',
        short_name: 'Gym',
        description: 'Rutinas, registro de series y recomendaciones para entrenar en casa o en el gimnasio.',
        lang: 'es',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'] },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, proxy: apiProxy },
  // `vite preview` serves the production build with the same-origin API, like Caddy does.
  preview: { port: 4173, proxy: apiProxy },
});
