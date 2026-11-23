import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import { pushSubscriptions } from '../db/schema';
import type { Env } from '../env';
import { apiError } from '../lib/errors';
import type { AppVariables } from '../lib/middleware';
import { cancelRestPush, pushEnabled, scheduleRestPush } from '../lib/push';

const SubscriptionSchema = z.object({
  endpoint: z.url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const RestTimerSchema = z.object({ sessionId: z.uuid(), fireAt: z.iso.datetime({ offset: true }) });
const MAX_REST_MS = 60 * 60 * 1000;

export function pushRoutes(db: Database, config: Env) {
  return new Hono<{ Variables: AppVariables }>()
    .get('/vapid-key', (c) => c.json({ enabled: pushEnabled(config), publicKey: config.VAPID_PUBLIC_KEY ?? null }))
    .post('/subscriptions', async (c) => {
      if (!pushEnabled(config)) return apiError(c, 404, 'NOT_FOUND');
      const body = SubscriptionSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const owner = c.get('user').id;
      await db
        .insert(pushSubscriptions)
        .values({ ownerId: owner, endpoint: body.data.endpoint, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth, userAgent: c.req.header('user-agent') ?? null })
        // An endpoint moves to whoever registers it last on that browser.
        .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { ownerId: owner, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth } });
      return c.json({ ok: true });
    })
    .delete('/subscriptions', async (c) => {
      const body = z.object({ endpoint: z.string() }).safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, body.data.endpoint), eq(pushSubscriptions.ownerId, c.get('user').id)));
      return c.json({ ok: true });
    })
    .post('/rest-timer', async (c) => {
      const body = RestTimerSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const fireAt = new Date(body.data.fireAt);
      const delta = fireAt.getTime() - Date.now();
      if (delta < 0 || delta > MAX_REST_MS) return apiError(c, 400, 'VALIDATION');
      await scheduleRestPush(db, c.get('user').id, body.data.sessionId, fireAt);
      return c.json({ ok: true });
    })
    .delete('/rest-timer/:sessionId', async (c) => {
      const id = z.uuid().safeParse(c.req.param('sessionId'));
      if (!id.success) return apiError(c, 400, 'VALIDATION');
      await cancelRestPush(db, c.get('user').id, id.data);
      return c.json({ ok: true });
    });
}
