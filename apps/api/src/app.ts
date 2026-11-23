import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import type { Database } from './db/client';
import type { Env } from './env';
import { createAuth, type Auth } from './lib/auth';
import { apiError } from './lib/errors';
import { originCheck, requireSession, type AppVariables } from './lib/middleware';
import { SyncRegistry } from './lib/sync-registry';
import { logger } from './logger';
import { configRoutes } from './routes/config';
import { invitationRoutes } from './routes/invitations';
import { meRoutes } from './routes/me';
import { pushRoutes } from './routes/push';
import { syncRoutes } from './routes/sync';

export interface AppDeps {
  db: Database;
  config: Env;
  registry?: SyncRegistry;
  auth?: Auth;
}

/**
 * HTTP application. Everything lives under /api so the PWA and the API share one origin
 * (Caddy in production, Vite proxy in development).
 */
export function createApp({ db, config, registry = new SyncRegistry(), auth = createAuth(db, config) }: AppDeps) {
  const allowedOrigin = new URL(config.BETTER_AUTH_URL).origin;

  const app = new Hono<{ Variables: AppVariables }>().basePath('/api');

  app.onError((err, c) => {
    logger.error({ err: { message: err.message, name: err.name }, path: c.req.path }, 'request failed');
    return apiError(c, 500, 'INTERNAL');
  });
  app.notFound((c) => apiError(c, 404, 'NOT_FOUND'));

  // Liveness: never touches the database, so a slow database does not restart the app.
  app.get('/health/live', (c) => c.json({ status: 'ok' }));
  // Readiness: ready only when the database answers.
  app.get('/health', async (c) => {
    try {
      await db.execute(sql`select 1`);
      return c.json({ status: 'ok' });
    } catch {
      return c.json({ status: 'unavailable' }, 503);
    }
  });

  app.use('*', originCheck(allowedOrigin));

  app.on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw));
  app.route('/invitations', invitationRoutes(db, config));
  app.route('/config', configRoutes(config));

  app.use('/sync/*', requireSession(auth));
  app.route('/sync', syncRoutes(db, registry));
  app.use('/push/*', requireSession(auth));
  app.route('/push', pushRoutes(db, config));
  app.use('/me/*', requireSession(auth));
  app.use('/me', requireSession(auth));
  app.route('/me', meRoutes(db, registry, auth));

  return app;
}

export type App = ReturnType<typeof createApp>;
