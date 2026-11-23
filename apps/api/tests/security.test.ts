import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { env } from '../src/env';
import { createInvitation } from '../src/lib/invitations';
import { ORIGIN, call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);

afterAll(() => pool.end());

describe('security middleware', () => {
  it('rejects sync without a session with 401 and a Spanish message', async () => {
    const res = await call(app, '/api/sync/pull');
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Tienes que iniciar sesión.' },
    });
  });

  it('rejects a state-changing request without Origin (403)', async () => {
    const { cookie } = await signUp(app);
    const res = await call(app, '/api/sync/push', { method: 'POST', cookie, origin: null, body: {} });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('BAD_ORIGIN');
  });

  it('rejects a state-changing request from another origin (403)', async () => {
    const { cookie } = await signUp(app);
    const res = await call(app, '/api/sync/push', {
      method: 'POST',
      cookie,
      origin: 'https://evil.example',
      body: {},
    });
    expect(res.status).toBe(403);
  });

  it('rejects sign-up from another origin', async () => {
    const res = await call(app, '/api/auth/sign-up/email', {
      method: 'POST',
      origin: 'https://evil.example',
      body: { email: 'x@test.local', password: 'una-clave-segura', name: 'X' },
    });
    expect(res.status).toBe(403);
  });

  it('accepts a session cookie and serves sync', async () => {
    const { cookie } = await signUp(app);
    const res = await call(app, '/api/sync/pull', { cookie });
    expect(res.status).toBe(200);
  });

  it('returns 404 in Spanish for unknown routes', async () => {
    const res = await call(app, '/api/nope');
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { message: string } }).error.message).toBe(
      'No encontramos lo que buscas.',
    );
  });

  it('never lets sign-up set the role', async () => {
    const res = await call(app, '/api/auth/sign-up/email', {
      method: 'POST',
      body: {
        email: `admin${Date.now()}@test.local`,
        password: 'una-clave-segura',
        name: 'X',
        role: 'admin',
        inviteCode: (await createInvitation(db)).code,
      },
    });
    // Better Auth rejects input fields marked `input: false`.
    if (res.status === 200) {
      const body = (await res.json()) as { user: { role?: string } };
      expect(body.user.role).toBe('user');
    } else {
      expect(res.status).toBe(400);
    }
  });
});

describe('login rate limiting', () => {
  it('blocks repeated sign-in attempts from the same client IP (Cloudflare header)', async () => {
    const limited = createApp({ db, config: { ...env(), AUTH_RATE_LIMIT: 'on' } });
    const attempt = (ip: string) =>
      limited.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN, 'cf-connecting-ip': ip },
        body: JSON.stringify({ email: 'nadie@test.local', password: 'incorrecta-123' }),
      });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await attempt('203.0.113.7')).status);
    expect(statuses).toContain(429);
    // Another visitor is not affected by the first one's attempts.
    expect((await attempt('203.0.113.8')).status).not.toBe(429);
  });
});
