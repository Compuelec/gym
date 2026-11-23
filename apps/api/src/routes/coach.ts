import { Hono } from 'hono';
import type { Database } from '../db/client';
import type { Env } from '../env';
import { availability, getSettings } from '../lib/ai-settings';
import type { AppVariables } from '../lib/middleware';

/** Coach routes. US7 adds availability; requests are added with the coach itself (US6). */
export function coachRoutes(db: Database, config: Env) {
  return new Hono<{ Variables: AppVariables }>().get('/status', async (c) => {
    const status = availability(await getSettings(db), config);
    return c.json(status.available ? { available: true } : { available: false, reason: status.reason });
  });
}
