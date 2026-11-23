import { Hono } from 'hono';
import { z } from 'zod';
import { SYNC_PULL_DEFAULT_LIMIT, SyncPushRequestSchema } from '@gym/shared';
import type { Database } from '../db/client';
import { apiError } from '../lib/errors';
import type { AppVariables } from '../lib/middleware';
import { pullChanges, pushMutations } from '../lib/sync-engine';
import type { SyncRegistry } from '../lib/sync-registry';

const PullQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(SYNC_PULL_DEFAULT_LIMIT).default(SYNC_PULL_DEFAULT_LIMIT),
});

export function syncRoutes(db: Database, registry: SyncRegistry) {
  return new Hono<{ Variables: AppVariables }>()
    .post('/push', async (c) => {
      const body = SyncPushRequestSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const results = await pushMutations(db, registry, c.get('user').id, body.data.mutations);
      return c.json({ results });
    })
    .get('/pull', async (c) => {
      const query = PullQuerySchema.safeParse(c.req.query());
      if (!query.success) return apiError(c, 400, 'VALIDATION');
      const page = await pullChanges(db, registry, c.get('user').id, query.data.cursor, query.data.limit);
      return c.json(page);
    });
}
