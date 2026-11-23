import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app';
import { adminAudit, appSettings, coachRequests, user } from '../src/db/schema';
import { env } from '../src/env';
import type { AiGateway } from '../src/lib/ai-client';
import { createInvitation } from '../src/lib/invitations';
import { ORIGIN, call, createTestDb } from './helpers/test-app';
import { ENTITIES } from '../src/entities';
import { SyncRegistry } from '../src/lib/sync-registry';

const { db, pool } = createTestDb();
const VALID = 'sk-ant-api03-valid-key-for-tests-wxyz';
const tested: string[] = [];
const ai: AiGateway = {
  async testKey(key) {
    tested.push(key);
    if (key !== VALID) throw new Error('401');
  },
};
const app = createApp({ db, config: env(), registry: new SyncRegistry(ENTITIES), ai });

async function account(role: 'user' | 'admin') {
  const email = `adm${Date.now()}${Math.random()}@test.local`;
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: 'una-clave-segura', name: 'A', inviteCode: (await createInvitation(db)).code }),
  });
  const id = ((await res.json()) as { user: { id: string } }).user.id;
  if (role === 'admin') await db.update(user).set({ role: 'admin' }).where(eq(user.id, id));
  return { cookie: res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; '), id };
}

let admin: { cookie: string; id: string };
let normal: { cookie: string; id: string };
beforeAll(async () => {
  await db.delete(appSettings);
  admin = await account('admin');
  normal = await account('user');
});
afterAll(() => pool.end());

describe('admin AI settings', () => {
  it('only admins can read or change them (403 for a normal user)', async () => {
    expect((await call(app, '/api/admin/settings/ai', { cookie: normal.cookie })).status).toBe(403);
    expect((await call(app, '/api/admin/settings/ai', { method: 'PATCH', cookie: normal.cookie, body: { enabled: true } })).status).toBe(403);
    expect((await call(app, '/api/admin/settings/ai/key', { method: 'PUT', cookie: normal.cookie, body: { apiKey: VALID } })).status).toBe(403);
    expect((await call(app, '/api/admin/invitations', { method: 'POST', cookie: normal.cookie, body: {} })).status).toBe(403);
    expect((await call(app, '/api/admin/settings/ai')).status).toBe(401);
  });

  it('starts disabled, with Haiku 5.5 and default limits; cannot be enabled without a key', async () => {
    const view = (await (await call(app, '/api/admin/settings/ai', { cookie: admin.cookie })).json()) as Record<string, unknown>;
    expect(view).toMatchObject({ enabled: false, available: false, reason: 'DISABLED', model: 'claude-haiku-5-5', keyConfigured: false, dailyLimitPerUser: 20, monthlyBudgetUsd: 5 });
    const res = await call(app, '/api/admin/settings/ai', { method: 'PATCH', cookie: admin.cookie, body: { enabled: true } });
    expect(res.status).toBe(409);
  });

  it('an invalid key is tested, rejected (422) and not stored', async () => {
    const res = await call(app, '/api/admin/settings/ai/key', { method: 'PUT', cookie: admin.cookie, body: { apiKey: 'sk-ant-api03-wrong-key-for-tests-0000' } });
    expect(res.status).toBe(422);
    const [row] = await db.select().from(appSettings);
    expect(row?.aiApiKeyCiphertext).toBeNull();
  });

  it('a valid key is stored encrypted and never returned; only the last 4 characters are shown', async () => {
    const res = await call(app, '/api/admin/settings/ai/key', { method: 'PUT', cookie: admin.cookie, body: { apiKey: VALID } });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(VALID);
    expect(JSON.parse(text)).toMatchObject({ keyConfigured: true, keyLast4: 'wxyz', keySource: 'admin' });
    const [row] = await db.select().from(appSettings);
    expect(row?.aiApiKeyCiphertext).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(VALID);
    const get = await (await call(app, '/api/admin/settings/ai', { cookie: admin.cookie })).text();
    expect(get).not.toContain(VALID);
  });

  it('enable → coach available; disable → unavailable at once (no redeploy)', async () => {
    await call(app, '/api/admin/settings/ai', { method: 'PATCH', cookie: admin.cookie, body: { enabled: true } });
    expect(await (await call(app, '/api/coach/status', { cookie: normal.cookie })).json()).toEqual({ available: true });
    await call(app, '/api/admin/settings/ai', { method: 'PATCH', cookie: admin.cookie, body: { enabled: false } });
    expect(await (await call(app, '/api/coach/status', { cookie: normal.cookie })).json()).toEqual({ available: false, reason: 'DISABLED' });
  });

  it('test connection uses the stored key', async () => {
    tested.length = 0;
    const res = (await (await call(app, '/api/admin/settings/ai/test', { method: 'POST', cookie: admin.cookie })).json()) as { ok: boolean };
    expect(res.ok).toBe(true);
    expect(tested).toEqual([VALID]);
  });

  it('changes model and limits, rejects unknown models, shows monthly spend, resumes a pause', async () => {
    const ok = await call(app, '/api/admin/settings/ai', { method: 'PATCH', cookie: admin.cookie, body: { model: 'claude-sonnet-5-5', dailyLimitPerUser: 5, monthlyBudgetUsd: 2.5 } });
    expect(await ok.json()).toMatchObject({ model: 'claude-sonnet-5-5', dailyLimitPerUser: 5, monthlyBudgetUsd: 2.5 });
    expect((await call(app, '/api/admin/settings/ai', { method: 'PATCH', cookie: admin.cookie, body: { model: 'gpt-9' } })).status).toBe(400);
    await db.insert(coachRequests).values({ ownerId: normal.id, kind: 'program', messages: [], status: 'done', costUsd: 0.0123 });
    await db.update(appSettings).set({ aiPausedReason: 'BUDGET_REACHED', aiEnabled: true });
    const paused = (await (await call(app, '/api/admin/settings/ai', { cookie: admin.cookie })).json()) as Record<string, unknown>;
    expect(paused).toMatchObject({ available: false, reason: 'PAUSED', pausedReason: 'BUDGET_REACHED' });
    expect(paused.monthSpentUsd).toBeCloseTo(0.0123, 4);
    const resumed = await call(app, '/api/admin/settings/ai', { method: 'PATCH', cookie: admin.cookie, body: { clearPause: true } });
    expect(await resumed.json()).toMatchObject({ available: true, pausedReason: null });
  });

  it('deleting the key disables the AI', async () => {
    const res = await call(app, '/api/admin/settings/ai/key', { method: 'DELETE', cookie: admin.cookie });
    expect(await res.json()).toMatchObject({ enabled: false, keyConfigured: false, keyLast4: null });
  });

  it('every change is audited without secrets', async () => {
    const entries = await db.select().from(adminAudit).where(eq(adminAudit.adminId, admin.id));
    const actions = entries.map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['ai_key_set', 'ai_enabled', 'ai_disabled', 'ai_model_changed', 'limits_changed', 'ai_resumed', 'ai_key_deleted']));
    expect(JSON.stringify(entries)).not.toContain(VALID);
  });
});

describe('admin invitations', () => {
  it('creates a code shown once, lists it without the code, and revokes it', async () => {
    const res = (await (await call(app, '/api/admin/invitations', { method: 'POST', cookie: admin.cookie, body: { email: 'nuevo@test.local', days: 3 } })).json()) as { id: string; code: string; url: string };
    expect(res.url).toContain(`/signup?invite=${res.code}`);
    const list = await (await call(app, '/api/admin/invitations', { cookie: admin.cookie })).text();
    expect(list).toContain(res.id);
    expect(list).not.toContain(res.code);
    await call(app, `/api/admin/invitations/${res.id}`, { method: 'DELETE', cookie: admin.cookie });
    const check = (await (await call(app, '/api/invitations/check', { method: 'POST', body: { code: res.code } })).json()) as { valid: boolean };
    expect(check.valid).toBe(false);
  });
});
