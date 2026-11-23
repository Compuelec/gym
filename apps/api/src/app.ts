import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import type { Database } from './db/client';
import type { Env } from './env';
import { createAuth, type Auth } from './lib/auth';
import { apiError } from './lib/errors';
import { originCheck, requireAdmin, requireSession, type AppVariables } from './lib/middleware';
import { createAiGateway, type AiGateway } from './lib/ai-client';
import { createMailer, type Mailer } from './lib/mailer';
import { SyncRegistry } from './lib/sync-registry';
import { logger } from './logger';
import { adminRoutes } from './routes/admin';
import { coachRoutes } from './routes/coach';
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
  ai?: AiGateway;
  mailer?: Mailer;
}

/**
 * HTTP application. Everything lives under /api so the PWA and the API share one origin
 * (Caddy in production, Vite proxy in development).
 */
export function createApp({ db, config, registry = new SyncRegistry(), mailer = createMailer(config, db), auth = createAuth(db, config, mailer), ai = createAiGateway(config) }: AppDeps) {
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

  // Request size: small JSON everywhere, a larger limit only for importing a full export.
  const tooLarge = (c: Context) => apiError(c, 413, 'VALIDATION', 'El archivo o los datos enviados son demasiado grandes.');
  const smallBody = bodyLimit({ maxSize: 2 * 1024 * 1024, onError: tooLarge });
  const importBody = bodyLimit({ maxSize: 20 * 1024 * 1024, onError: tooLarge });
  app.use('*', (c, next) => (c.req.path === '/api/me/import' ? importBody(c, next) : smallBody(c, next)));

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
  app.use('/admin/*', requireSession(auth), requireAdmin());
  app.route('/admin', adminRoutes(db, config, ai, mailer));
  app.use('/coach/*', requireSession(auth));
  app.route('/coach', coachRoutes(db, config));

  return app;
}

export type App = ReturnType<typeof createApp>;
