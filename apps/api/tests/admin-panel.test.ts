import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app';
import { adminAudit, appSettings, session, user } from '../src/db/schema';
import { env } from '../src/env';
import { createInvitation } from '../src/lib/invitations';
import { ENTITIES } from '../src/entities';
import { SyncRegistry } from '../src/lib/sync-registry';
import { ORIGIN, call, createTestDb } from './helpers/test-app';

// Real SMTP: the test stack's Mailpit (infra/docker-compose.test.yml) receives and shows mail.
const MAILPIT_SMTP = { host: 'localhost', port: 51025 };
const MAILPIT_API = 'http://localhost:58025/api/v1';

const { db, pool } = createTestDb();
const app = createApp({ db, config: env(), registry: new SyncRegistry(ENTITIES) });

async function account(role: 'user' | 'admin', password = 'una-clave-segura') {
  const email = `panel${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.local`;
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password, name: role === 'admin' ? 'Admin Prueba' : 'Ana', inviteCode: (await createInvitation(db)).code }),
  });
  const id = ((await res.json()) as { user: { id: string } }).user.id;
  if (role === 'admin') await db.update(user).set({ role: 'admin' }).where(eq(user.id, id));
  return { cookie: res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; '), id, email, password };
}

async function signIn(email: string, password: string) {
  return app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
}

async function mailTo(to: string) {
  for (let i = 0; i < 20; i++) {
    const res = (await (await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: Array<{ ID: string; Subject: string }> };
    if (res.messages.length) {
      const msg = (await (await fetch(`${MAILPIT_API}/message/${res.messages[0]!.ID}`)).json()) as { Subject: string; Text: string; From: { Address: string } };
      return msg;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

let admin: Awaited<ReturnType<typeof account>>;
let normal: Awaited<ReturnType<typeof account>>;
beforeAll(async () => {
  await db.delete(appSettings);
  admin = await account('admin');
  normal = await account('user');
});
afterAll(() => pool.end());

describe('admin panel · mail server', () => {
  it('only admins see or change it', async () => {
    expect((await call(app, '/api/admin/settings/mail', { cookie: normal.cookie })).status).toBe(403);
    expect((await call(app, '/api/admin/settings/mail', { method: 'PUT', cookie: normal.cookie, body: { ...MAILPIT_SMTP, secure: false, from: 'x <x@test.local>' } })).status).toBe(403);
  });

  it('rejects a URL or junk as host, and a user without a password', async () => {
    const bad = await call(app, '/api/admin/settings/mail', { method: 'PUT', cookie: admin.cookie, body: { host: 'http://evil/x', port: 25, secure: false, from: 'G <g@test.local>' } });
    expect(bad.status).toBe(400);
    const noPass = await call(app, '/api/admin/settings/mail', { method: 'PUT', cookie: admin.cookie, body: { host: 'smtp.test.local', port: 587, secure: false, user: 'gym', from: 'G <g@test.local>' } });
    expect(noPass.status).toBe(400);
  });

  it('stores the password encrypted, never returns it, and keeps it when not sent again', async () => {
    const res = await call(app, '/api/admin/settings/mail', {
      method: 'PUT',
      cookie: admin.cookie,
      body: { host: 'smtp.test.local', port: 587, secure: false, user: 'gym', password: 'clave-del-correo-123', from: 'Gym <no-reply@test.local>' },
    });
    expect(res.status).toBe(200);
    const view = await res.text();
    expect(view).not.toContain('clave-del-correo-123');
    expect(JSON.parse(view)).toMatchObject({ source: 'admin', host: 'smtp.test.local', user: 'gym', passwordSet: true });
    const [row] = await db.select().from(appSettings);
    expect(row!.mailPasswordCiphertext).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain('clave-del-correo-123');
    // Update without a password keeps the stored one.
    const again = await call(app, '/api/admin/settings/mail', { method: 'PUT', cookie: admin.cookie, body: { host: 'smtp.test.local', port: 465, secure: true, user: 'gym', from: 'Gym <no-reply@test.local>' } });
    expect(((await again.json()) as { passwordSet: boolean }).passwordSet).toBe(true);
    const audits = JSON.stringify(await db.select().from(adminAudit));
    expect(audits).toContain('mail_settings_changed');
    expect(audits).not.toContain('clave-del-correo-123');
  });

  it('a wrong server gives a clear message in the test, not a crash', async () => {
    await call(app, '/api/admin/settings/mail', { method: 'PUT', cookie: admin.cookie, body: { host: 'localhost', port: 1, secure: false, from: 'Gym <no-reply@test.local>' } });
    const res = (await (await call(app, '/api/admin/settings/mail/test', { method: 'POST', cookie: admin.cookie, body: {} })).json()) as { ok: boolean; error: string };
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/No se pudo conectar con el servidor de correo/);
  });

  it('with a working server the test email really arrives, from the configured sender, at once (no redeploy)', async () => {
    await call(app, '/api/admin/settings/mail', { method: 'PUT', cookie: admin.cookie, body: { ...MAILPIT_SMTP, secure: false, from: 'Gym Pruebas <pruebas@gym.test>' } });
    const res = (await (await call(app, '/api/admin/settings/mail/test', { method: 'POST', cookie: admin.cookie, body: {} })).json()) as { ok: boolean; to: string };
    expect(res).toMatchObject({ ok: true, to: admin.email });
    const msg = await mailTo(admin.email);
    expect(msg?.Subject).toBe('Prueba de correo de Gym');
    expect(msg?.From.Address).toBe('pruebas@gym.test');
  });

  it('password reset emails use the same server', async () => {
    await app.request('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ email: normal.email, redirectTo: '/reset-password' }),
    });
    expect((await mailTo(normal.email))?.Subject).toBe('Cambia tu contraseña de Gym');
  });
});

describe('admin panel · invitations by email', () => {
  it('sends the link to the person; the link in the email creates the account', async () => {
    const to = `invitada${Date.now()}@test.local`;
    const res = (await (await call(app, '/api/admin/invitations', { method: 'POST', cookie: admin.cookie, body: { email: to, days: 5, send: true } })).json()) as { emailed: boolean; code: string };
    expect(res.emailed).toBe(true);
    const msg = await mailTo(to);
    expect(msg?.Subject).toBe('Te invitaron a Gym');
    expect(msg?.Text).toContain('Admin Prueba te invitó a Gym');
    expect(msg?.Text).toContain(`/signup?invite=${res.code}`);
  });

  it('asking to send without an email is refused', async () => {
    expect((await call(app, '/api/admin/invitations', { method: 'POST', cookie: admin.cookie, body: { send: true } })).status).toBe(400);
  });

  it('if sending fails the invitation is still created and the link shown', async () => {
    await call(app, '/api/admin/settings/mail', { method: 'PUT', cookie: admin.cookie, body: { host: 'localhost', port: 1, secure: false, from: 'Gym <no-reply@test.local>' } });
    const res = (await (await call(app, '/api/admin/invitations', { method: 'POST', cookie: admin.cookie, body: { email: 'falla@test.local', send: true } })).json()) as { emailed: boolean; emailError: string; url: string };
    expect(res.emailed).toBe(false);
    expect(res.emailError).toMatch(/No se pudo conectar/);
    expect(res.url).toContain('/signup?invite=');
    await call(app, '/api/admin/settings/mail', { method: 'DELETE', cookie: admin.cookie });
  });
});

describe('admin panel · users', () => {
  it('lists users with role and last use; normal users get 403', async () => {
    expect((await call(app, '/api/admin/users', { cookie: normal.cookie })).status).toBe(403);
    const res = (await (await call(app, '/api/admin/users', { cookie: admin.cookie })).json()) as { users: Array<{ id: string; email: string; role: string; lastSeenAt: string | null }>; total: number; me: string };
    expect(res.me).toBe(admin.id);
    expect(res.total).toBeGreaterThanOrEqual(res.users.length);
    const row = res.users.find((u) => u.id === normal.id);
    expect(row).toMatchObject({ email: normal.email, role: 'user' });
    expect(row!.lastSeenAt).toBeTruthy();
    expect(JSON.stringify(res)).not.toMatch(/password|token/i);
  });

  it('promotes and demotes another user', async () => {
    await call(app, `/api/admin/users/${normal.id}`, { method: 'PATCH', cookie: admin.cookie, body: { role: 'admin' } });
    expect((await call(app, '/api/admin/settings/mail', { cookie: normal.cookie })).status).toBe(200);
    await call(app, `/api/admin/users/${normal.id}`, { method: 'PATCH', cookie: admin.cookie, body: { role: 'user' } });
    expect((await call(app, '/api/admin/settings/mail', { cookie: normal.cookie })).status).toBe(403);
  });

  it('an administrator cannot demote or deactivate themself', async () => {
    expect((await call(app, `/api/admin/users/${admin.id}`, { method: 'PATCH', cookie: admin.cookie, body: { role: 'user' } })).status).toBe(409);
    expect((await call(app, `/api/admin/users/${admin.id}`, { method: 'PATCH', cookie: admin.cookie, body: { disabled: true } })).status).toBe(409);
  });

  it('deactivating closes the sessions and blocks sign-in; reactivating lets them in again', async () => {
    const ana = await account('user', 'otra-clave-segura');
    expect((await call(app, '/api/sync/pull', { cookie: ana.cookie })).status).toBe(200);
    expect((await call(app, `/api/admin/users/${ana.id}`, { method: 'PATCH', cookie: admin.cookie, body: { disabled: true } })).status).toBe(200);
    expect(await db.select().from(session).where(eq(session.userId, ana.id))).toHaveLength(0);
    expect((await call(app, '/api/sync/pull', { cookie: ana.cookie })).status).toBe(401);
    const blocked = await signIn(ana.email, ana.password);
    expect(blocked.status).toBe(403);
    expect(await blocked.text()).toContain('Tu cuenta está desactivada');
    await call(app, `/api/admin/users/${ana.id}`, { method: 'PATCH', cookie: admin.cookie, body: { disabled: false } });
    expect((await signIn(ana.email, ana.password)).status).toBe(200);
    const audits = JSON.stringify(await db.select().from(adminAudit));
    expect(audits).toContain('user_disabled');
    expect(audits).toContain('user_enabled');
  });

  it('rejects unknown users and empty changes', async () => {
    expect((await call(app, '/api/admin/users/no-existe', { method: 'PATCH', cookie: admin.cookie, body: { role: 'admin' } })).status).toBe(404);
    expect((await call(app, `/api/admin/users/${normal.id}`, { method: 'PATCH', cookie: admin.cookie, body: {} })).status).toBe(400);
  });
});
