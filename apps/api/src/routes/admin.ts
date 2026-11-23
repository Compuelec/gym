import { Hono } from 'hono';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import { adminAudit, AI_MODELS, invitations } from '../db/schema';
import type { Env } from '../env';
import type { AiGateway } from '../lib/ai-client';
import { audit, getSettings, publicView, storeKey, updateSettings } from '../lib/ai-settings';
import { EncryptionKeyError } from '../lib/crypto';
import { apiError } from '../lib/errors';
import { createInvitation } from '../lib/invitations';
import type { AppVariables } from '../lib/middleware';

const PatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    model: z.enum(AI_MODELS).optional(),
    dailyLimitPerUser: z.number().int().min(0).max(500).optional(),
    monthlyBudgetUsd: z.number().min(0).max(10_000).optional(),
    clearPause: z.literal(true).optional(),
  })
  .strict();
const KeySchema = z.object({ apiKey: z.string().trim().min(20).max(300) });
const InviteSchema = z.object({ email: z.email().optional(), days: z.number().int().min(1).max(90).optional() });

export function adminRoutes(db: Database, config: Env, ai: AiGateway) {
  return new Hono<{ Variables: AppVariables }>()
    .get('/settings/ai', async (c) => c.json(await publicView(db, config)))
    .patch('/settings/ai', async (c) => {
      const body = PatchSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const admin = c.get('user').id;
      const view = await publicView(db, config);
      if (body.data.enabled && !view.keyConfigured) return apiError(c, 409, 'CONFLICT', 'Primero guarda la clave del servicio de IA.');
      const patch: Record<string, unknown> = {};
      if (body.data.enabled !== undefined) patch.aiEnabled = body.data.enabled;
      if (body.data.model) patch.aiModel = body.data.model;
      if (body.data.dailyLimitPerUser !== undefined) patch.aiDailyLimitPerUser = body.data.dailyLimitPerUser;
      if (body.data.monthlyBudgetUsd !== undefined) patch.aiMonthlyBudgetUsd = body.data.monthlyBudgetUsd;
      if (body.data.clearPause) patch.aiPausedReason = null;
      await updateSettings(db, patch, admin);
      if (body.data.enabled !== undefined) await audit(db, admin, body.data.enabled ? 'ai_enabled' : 'ai_disabled');
      if (body.data.model) await audit(db, admin, 'ai_model_changed', { model: body.data.model });
      if (body.data.dailyLimitPerUser !== undefined || body.data.monthlyBudgetUsd !== undefined)
        await audit(db, admin, 'limits_changed', { dailyLimitPerUser: body.data.dailyLimitPerUser, monthlyBudgetUsd: body.data.monthlyBudgetUsd });
      if (body.data.clearPause) await audit(db, admin, 'ai_resumed');
      return c.json(await publicView(db, config));
    })
    .put('/settings/ai/key', async (c) => {
      const body = KeySchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION', 'La clave no tiene un formato válido.');
      const settings = await getSettings(db);
      try {
        await ai.testKey(body.data.apiKey, settings.aiModel);
      } catch {
        return apiError(c, 422, 'VALIDATION', 'El servicio de IA rechazó la clave. Revísala e intenta de nuevo.');
      }
      try {
        await storeKey(db, config, body.data.apiKey, c.get('user').id);
      } catch (err) {
        if (err instanceof EncryptionKeyError) return apiError(c, 503, 'INTERNAL', err.message);
        throw err;
      }
      const view = await publicView(db, config);
      await audit(db, c.get('user').id, 'ai_key_set', { last4: view.keyLast4 });
      return c.json(view);
    })
    .delete('/settings/ai/key', async (c) => {
      await updateSettings(
        db,
        { aiApiKeyCiphertext: null, aiApiKeyIv: null, aiApiKeyTag: null, aiApiKeyLast4: null, aiApiKeyUpdatedAt: null, aiEnabled: false },
        c.get('user').id,
      );
      await audit(db, c.get('user').id, 'ai_key_deleted');
      return c.json(await publicView(db, config));
    })
    .post('/settings/ai/test', async (c) => {
      const settings = await getSettings(db);
      const { resolveKey } = await import('../lib/ai-settings');
      const key = resolveKey(settings, config);
      if (!key) return apiError(c, 409, 'CONFLICT', 'No hay una clave guardada.');
      const started = Date.now();
      try {
        await ai.testKey(key, settings.aiModel);
        return c.json({ ok: true, latencyMs: Date.now() - started, model: settings.aiModel });
      } catch {
        return c.json({ ok: false, latencyMs: Date.now() - started, model: settings.aiModel });
      }
    })
    .get('/audit', async (c) => c.json({ entries: await db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(100) }))
    .post('/invitations', async (c) => {
      const body = InviteSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const inv = await createInvitation(db, { createdBy: c.get('user').id, email: body.data.email, days: body.data.days });
      await audit(db, c.get('user').id, 'invite_created', { email: body.data.email ?? null, days: body.data.days ?? 7 });
      // The code is shown once; only its hash is stored.
      return c.json({ id: inv.id, code: inv.code, url: `${config.BETTER_AUTH_URL}/signup?invite=${encodeURIComponent(inv.code)}`, expiresAt: inv.expiresAt.toISOString() });
    })
    .get('/invitations', async (c) => {
      const rows = await db
        .select({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt, usedAt: invitations.usedAt, revokedAt: invitations.revokedAt, createdAt: invitations.createdAt })
        .from(invitations)
        .orderBy(desc(invitations.createdAt))
        .limit(100);
      return c.json({ invitations: rows });
    })
    .delete('/invitations/:id', async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return apiError(c, 400, 'VALIDATION');
      await db.update(invitations).set({ revokedAt: sql`now()` }).where(eq(invitations.id, id.data));
      await audit(db, c.get('user').id, 'invite_revoked', { id: id.data });
      return c.json({ ok: true });
    });
}
