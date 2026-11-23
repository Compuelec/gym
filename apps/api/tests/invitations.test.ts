import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { invitations } from '../src/db/schema';
import { env } from '../src/env';
import {
  createInvitation,
  hashCode,
  readInviteCookie,
  signInviteCookie,
} from '../src/lib/invitations';
import { ORIGIN, call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);
afterAll(() => pool.end());

let n = 0;
const email = () => `inv${Date.now()}${++n}@test.local`;

function signUpRaw(body: Record<string, unknown>, headers: Record<string, string> = {}) {
  return app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify({ password: 'una-clave-segura', name: 'Prueba', ...body }),
  });
}

describe('sign-up by invitation', () => {
  it('rejects sign-up without a code (403 INVITE_REQUIRED, Spanish message)', async () => {
    const res = await signUpRaw({ email: email() });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('INVITE_REQUIRED');
    expect(body.message).toMatch(/invitación/);
  });

  it('accepts a valid code once, records who used it, and rejects reuse', async () => {
    const { code, id } = await createInvitation(db);
    const first = email();
    expect((await signUpRaw({ email: first, inviteCode: code })).status).toBe(200);
    const [row] = await db.select().from(invitations).where(eq(invitations.id, id));
    expect(row?.usedAt).toBeTruthy();
    expect(row?.usedEmail).toBe(first);
    expect(row?.usedBy).toBeTruthy();
    expect((await signUpRaw({ email: email(), inviteCode: code })).status).toBe(403);
  });

  it('accepts codes regardless of dashes, spaces and case', async () => {
    const { code } = await createInvitation(db);
    const sloppy = ` ${code.replaceAll('-', ' ').toLowerCase()} `;
    expect((await signUpRaw({ email: email(), inviteCode: sloppy })).status).toBe(200);
  });

  it('rejects expired and revoked codes', async () => {
    const expired = await createInvitation(db, { days: -1 });
    expect((await signUpRaw({ email: email(), inviteCode: expired.code })).status).toBe(403);
    const revoked = await createInvitation(db);
    await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, revoked.id));
    expect((await signUpRaw({ email: email(), inviteCode: revoked.code })).status).toBe(403);
  });

  it('enforces an invitation bound to an email', async () => {
    const bound = email();
    const { code } = await createInvitation(db, { email: bound });
    expect((await signUpRaw({ email: email(), inviteCode: code })).status).toBe(403);
    expect((await signUpRaw({ email: bound.toUpperCase(), inviteCode: code })).status).toBe(200);
  });

  it('only one of two concurrent sign-ups can use the same code', async () => {
    const { code } = await createInvitation(db);
    const results = await Promise.all([
      signUpRaw({ email: email(), inviteCode: code }),
      signUpRaw({ email: email(), inviteCode: code }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 403]);
  });

  it('stores only a hash of the code', async () => {
    const { code, id } = await createInvitation(db);
    const [row] = await db.select().from(invitations).where(eq(invitations.id, id));
    expect(row?.codeHash).toBe(hashCode(code));
    expect(JSON.stringify(row)).not.toContain(code);
  });
});

describe('invitation endpoints', () => {
  it('check tells whether a code is usable', async () => {
    const { code } = await createInvitation(db);
    const ok = await call(app, '/api/invitations/check', { method: 'POST', body: { code } });
    expect(await ok.json()).toMatchObject({ valid: true });
    const bad = await call(app, '/api/invitations/check', { method: 'POST', body: { code: 'NOPE-NOPE' } });
    expect(await bad.json()).toEqual({ valid: false });
  });

  it('claim sets a signed, httpOnly cookie that authorizes social sign-up', async () => {
    const { code } = await createInvitation(db);
    const res = await call(app, '/api/invitations/claim', { method: 'POST', body: { code } });
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^gym_invite=.+; Path=\/api\/auth; HttpOnly; SameSite=Lax/);
    // The cookie alone (no body code) lets the account be created: same path Google uses.
    const value = cookie.split(';')[0]!;
    const res2 = await signUpRaw({ email: email() }, { cookie: value });
    expect(res2.status).toBe(200);
  });

  it('claim rejects invalid codes', async () => {
    const res = await call(app, '/api/invitations/claim', { method: 'POST', body: { code: 'XXXX-YYYY' } });
    expect(res.status).toBe(403);
  });

  it('rejects tampered or expired invite cookies', () => {
    const secret = env().BETTER_AUTH_SECRET;
    const value = signInviteCookie('ABCD-EFGH', secret);
    expect(readInviteCookie(value, secret)).toBe('ABCDEFGH');
    expect(readInviteCookie(value.replace('ABCDEFGH', 'ZZZZEFGH'), secret)).toBeNull();
    expect(readInviteCookie(value, 'otro-secreto-otro-secreto-otro-secreto')).toBeNull();
    expect(readInviteCookie(signInviteCookie('ABCD', secret, Date.now() - 3_600_000), secret)).toBeNull();
  });

  it('helper signUp still works for other suites', async () => {
    expect((await signUp(app)).userId).toBeTruthy();
  });
});
