import { Hono } from 'hono';
import type { Env } from '../env';

/** Public client configuration (which sign-in methods exist). No secrets here. */
export function configRoutes(config: Env) {
  return new Hono().get('/', (c) =>
    c.json({ google: Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) }),
  );
}
