import { Hono } from 'hono';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db/client';
import { adminAudit, AI_MODELS, invitations, session, user } from '../db/schema';
import type { Env } from '../env';
import type { AiGateway } from '../lib/ai-client';
import { audit, getSettings, publicView, storeKey, updateSettings } from '../lib/ai-settings';
import { EncryptionKeyError, seal } from '../lib/crypto';
import { invitationMail, mailErrorMessage, testMail, type Mailer } from '../lib/mailer';
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
const InviteSchema = z.object({
  email: z.email().optional(),
  days: z.number().int().min(1).max(90).optional(),
  // Send the link to `email` instead of only showing it.
  send: z.boolean().optional(),
});
const MailSchema = z
  .object({
    // A host name, not a URL: no scheme, path or spaces.
    host: z.string().trim().min(3).max(253).regex(/^[A-Za-z0-9.-]+$/, 'host'),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    user: z.string().trim().max(200).optional(),
    // Omitted on an update = keep the stored password.
    password: z.string().max(300).optional(),
    from: z.string().trim().min(3).max(200),
  })
  .strict();
const TestMailSchema = z.object({ to: z.email().optional() });
const UserPatchSchema = z.object({ role: z.enum(['user', 'admin']).optional(), disabled: z.boolean().optional() }).strict();

/** Mail settings as the admin screen sees them: never the password, only whether one is set. */
async function mailView(db: Database, config: Env) {
  const row = await getSettings(db);
  const source = row.mailHost ? 'admin' : config.SMTP_URL ? 'secret' : null;
  return {
    source,
    host: row.mailHost,
    port: row.mailPort,
    secure: row.mailSecure,
    user: row.mailUser,
    passwordSet: Boolean(row.mailPasswordCiphertext),
    from: row.mailFrom,
    defaultFrom: config.MAIL_FROM,
    updatedAt: row.mailUpdatedAt?.toISOString() ?? null,
    encryptionReady: Boolean(config.APP_ENCRYPTION_KEY),
  };
}

export function adminRoutes(db: Database, config: Env, ai: AiGateway, mailer: Mailer) {
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
      if (body.data.send && !body.data.email) return apiError(c, 400, 'VALIDATION', 'Escribe el correo de la persona para enviarle la invitación.');
      const admin = c.get('user');
      const inv = await createInvitation(db, { createdBy: admin.id, email: body.data.email, days: body.data.days });
      const url = `${config.BETTER_AUTH_URL}/signup?invite=${encodeURIComponent(inv.code)}`;
      let emailed = false;
      let emailError: string | null = null;
      if (body.data.send && body.data.email) {
        try {
          await mailer.send(invitationMail(body.data.email, url, inv.expiresAt, admin.name));
          emailed = true;
        } catch (err) {
          emailError = mailErrorMessage(err);
        }
      }
      await audit(db, admin.id, 'invite_created', { email: body.data.email ?? null, days: body.data.days ?? 7, emailed });
      // The code is shown once; only its hash is stored. If the email failed, the link still works.
      return c.json({ id: inv.id, code: inv.code, url, expiresAt: inv.expiresAt.toISOString(), emailed, emailError });
    })
    .get('/invitations', async (c) => {
      const rows = await db
        .select({ id: invitations.id, email: invitations.email, expiresAt: invitations.expiresAt, usedAt: invitations.usedAt, revokedAt: invitations.revokedAt, createdAt: invitations.createdAt })
        .from(invitations)
        .orderBy(desc(invitations.createdAt))
        .limit(100);
      return c.json({ invitations: rows });
    })
    .get('/settings/mail', async (c) => c.json(await mailView(db, config)))
    .put('/settings/mail', async (c) => {
      const body = MailSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION', 'Revisa los datos del servidor de correo.');
      const current = await getSettings(db);
      const patch: Record<string, unknown> = {
        mailHost: body.data.host.toLowerCase(),
        mailPort: body.data.port,
        mailSecure: body.data.secure,
        mailUser: body.data.user || null,
        mailFrom: body.data.from,
        mailUpdatedAt: new Date(),
      };
      try {
        if (body.data.password !== undefined && body.data.password !== '') {
          const sealed = seal(body.data.password, config.APP_ENCRYPTION_KEY);
          Object.assign(patch, { mailPasswordCiphertext: sealed.ciphertext, mailPasswordIv: sealed.iv, mailPasswordTag: sealed.tag });
        } else if (!body.data.user) {
          Object.assign(patch, { mailPasswordCiphertext: null, mailPasswordIv: null, mailPasswordTag: null });
        } else if (!current.mailPasswordCiphertext) {
          return apiError(c, 400, 'VALIDATION', 'Escribe la contraseña del correo.');
        }
      } catch (err) {
        if (err instanceof EncryptionKeyError) return apiError(c, 503, 'INTERNAL', err.message);
        throw err;
      }
      await updateSettings(db, patch, c.get('user').id);
      await audit(db, c.get('user').id, 'mail_settings_changed', { host: patch.mailHost, port: body.data.port, passwordChanged: Boolean(body.data.password) });
      return c.json(await mailView(db, config));
    })
    .delete('/settings/mail', async (c) => {
      await updateSettings(
        db,
        { mailHost: null, mailPort: null, mailSecure: null, mailUser: null, mailPasswordCiphertext: null, mailPasswordIv: null, mailPasswordTag: null, mailFrom: null, mailUpdatedAt: new Date() },
        c.get('user').id,
      );
      await audit(db, c.get('user').id, 'mail_settings_deleted');
      return c.json(await mailView(db, config));
    })
    .post('/settings/mail/test', async (c) => {
      const body = TestMailSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const view = await mailView(db, config);
      if (!view.source) return apiError(c, 409, 'CONFLICT', 'Primero configura el servidor de correo.');
      const to = body.data.to ?? c.get('user').email;
      try {
        await mailer.send(testMail(to));
        await audit(db, c.get('user').id, 'mail_test', { ok: true });
        return c.json({ ok: true, to });
      } catch (err) {
        await audit(db, c.get('user').id, 'mail_test', { ok: false });
        return c.json({ ok: false, to, error: mailErrorMessage(err) });
      }
    })
    .get('/users', async (c) => {
      const lastSeen = db
        .select({ userId: session.userId, at: sql<Date>`max(${session.updatedAt})`.as('at') })
        .from(session)
        .groupBy(session.userId)
        .as('last_seen');
      const rows = await db
        .select({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, disabledAt: user.disabledAt, lastSeenAt: lastSeen.at })
        .from(user)
        .leftJoin(lastSeen, eq(lastSeen.userId, user.id))
        .orderBy(desc(user.createdAt))
        .limit(500);
      const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)::int` }).from(user);
      return c.json({ users: rows, total, me: c.get('user').id });
    })
    .patch('/users/:id', async (c) => {
      const id = c.req.param('id');
      const body = UserPatchSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success || (body.data.role === undefined && body.data.disabled === undefined)) return apiError(c, 400, 'VALIDATION');
      const me = c.get('user').id;
      // Never lock yourself out (and so never leave the app without an administrator).
      if (id === me && (body.data.role === 'user' || body.data.disabled)) return apiError(c, 409, 'CONFLICT', 'No puedes quitarte el rol ni desactivar tu propia cuenta.');
      const [target] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, id));
      if (!target) return apiError(c, 404, 'NOT_FOUND');
      const patch: Record<string, unknown> = {};
      if (body.data.role) patch.role = body.data.role;
      if (body.data.disabled !== undefined) patch.disabledAt = body.data.disabled ? new Date() : null;
      await db.transaction(async (tx) => {
        await tx.update(user).set({ ...patch, updatedAt: new Date() }).where(eq(user.id, id));
        // Deactivated: close every open session at once.
        if (body.data.disabled) await tx.delete(session).where(eq(session.userId, id));
      });
      if (body.data.role) await audit(db, me, body.data.role === 'admin' ? 'user_promoted' : 'user_demoted', { userId: id });
      if (body.data.disabled !== undefined) await audit(db, me, body.data.disabled ? 'user_disabled' : 'user_enabled', { userId: id });
      return c.json({ ok: true });
    })
    .delete('/invitations/:id', async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return apiError(c, 400, 'VALIDATION');
      await db.update(invitations).set({ revokedAt: sql`now()` }).where(eq(invitations.id, id.data));
      await audit(db, c.get('user').id, 'invite_revoked', { id: id.data });
      return c.json({ ok: true });
    });
}
