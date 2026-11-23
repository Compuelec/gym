import { Hono } from 'hono';

// HTTP application. Routes are mounted under /api so the PWA and the API share one origin.
export function createApp() {
  const app = new Hono().basePath('/api');

  // Liveness only for now; the database ping is added in Phase 2 (T023).
  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
}
