import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { uuidv7 } from '@gym/shared';
import { createApp } from '../src/app';
import { pushSubscriptions, scheduledPushes } from '../src/db/schema';
import { env } from '../src/env';
import { sendDuePushes, type PushSender } from '../src/lib/push';
import { createInvitation } from '../src/lib/invitations';
import { ORIGIN, call, createTestDb } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createApp({ db, config: { ...env(), VAPID_PUBLIC_KEY: 'BPub', VAPID_PRIVATE_KEY: 'priv' } });
afterAll(() => pool.end());

async function user() {
  const email = `push${Date.now()}${Math.random()}@test.local`;
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: 'una-clave-segura', name: 'P', inviteCode: (await createInvitation(db)).code }),
  });
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return { cookie, id: ((await res.json()) as { user: { id: string } }).user.id };
}

const sub = (n: string) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'k', auth: 'a' } });

describe('push', () => {
  it('requires a session', async () => {
    expect((await call(app, '/api/push/vapid-key')).status).toBe(401);
  });

  it('schedules a rest notification, replaces the previous one, and cancels it', async () => {
    const u = await user();
    const sessionId = uuidv7();
    expect((await call(app, '/api/push/subscriptions', { method: 'POST', cookie: u.cookie, body: sub(uuidv7()) })).status).toBe(200);
    const at = (s: number) => new Date(Date.now() + s * 1000).toISOString();
    expect((await call(app, '/api/push/rest-timer', { method: 'POST', cookie: u.cookie, body: { sessionId, fireAt: at(90) } })).status).toBe(200);
    await call(app, '/api/push/rest-timer', { method: 'POST', cookie: u.cookie, body: { sessionId, fireAt: at(60) } });
    let rows = await db.select().from(scheduledPushes).where(eq(scheduledPushes.sessionId, sessionId));
    expect(rows.filter((r) => !r.cancelledAt)).toHaveLength(1);
    await call(app, `/api/push/rest-timer/${sessionId}`, { method: 'DELETE', cookie: u.cookie });
    rows = await db.select().from(scheduledPushes).where(eq(scheduledPushes.sessionId, sessionId));
    expect(rows.every((r) => r.cancelledAt)).toBe(true);
  });

  it('rejects past or far-future times', async () => {
    const u = await user();
    const body = (s: number) => ({ sessionId: uuidv7(), fireAt: new Date(Date.now() + s * 1000).toISOString() });
    expect((await call(app, '/api/push/rest-timer', { method: 'POST', cookie: u.cookie, body: body(-5) })).status).toBe(400);
    expect((await call(app, '/api/push/rest-timer', { method: 'POST', cookie: u.cookie, body: body(7200) })).status).toBe(400);
  });

  it('the worker sends due notifications only to the owner, once, and drops dead subscriptions', async () => {
    const a = await user();
    const b = await user();
    const aSub = sub(`a-${uuidv7()}`);
    const deadSub = sub(`dead-${uuidv7()}`);
    await call(app, '/api/push/subscriptions', { method: 'POST', cookie: a.cookie, body: aSub });
    await call(app, '/api/push/subscriptions', { method: 'POST', cookie: a.cookie, body: deadSub });
    await call(app, '/api/push/subscriptions', { method: 'POST', cookie: b.cookie, body: sub(`b-${uuidv7()}`) });
    const sessionId = uuidv7();
    await db.insert(scheduledPushes).values({ ownerId: a.id, sessionId, kind: 'rest_end', fireAt: new Date(Date.now() - 1000) });

    const sent: string[] = [];
    const sender: PushSender = async (s, msg) => {
      if (s.endpoint === deadSub.endpoint) throw Object.assign(new Error('gone'), { statusCode: 410 });
      expect(msg.title).toBe('Descanso terminado');
      sent.push(s.endpoint);
    };
    await sendDuePushes(db, sender);
    expect(sent).toEqual([aSub.endpoint]);
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, deadSub.endpoint))).toHaveLength(0);
    await sendDuePushes(db, sender);
    expect(sent).toHaveLength(1); // not sent twice
  });

  it('a user cannot cancel or delete another user\'s subscription', async () => {
    const a = await user();
    const b = await user();
    const s = sub(`own-${uuidv7()}`);
    await call(app, '/api/push/subscriptions', { method: 'POST', cookie: a.cookie, body: s });
    await call(app, '/api/push/subscriptions', { method: 'DELETE', cookie: b.cookie, body: { endpoint: s.endpoint } });
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint))).toHaveLength(1);
  });

  it('only accepts HTTPS endpoints of real push services (never internal hosts)', async () => {
    const u = await user();
    const post = (endpoint: string) => call(app, '/api/push/subscriptions', { method: 'POST', cookie: u.cookie, body: { endpoint, keys: { p256dh: 'k', auth: 'a' } } });
    for (const bad of [
      'https://kubernetes.default.svc/api',
      'http://fcm.googleapis.com/fcm/send/x',
      'https://postgres:5432/x',
      'https://169.254.169.254/latest',
      'https://fcm.googleapis.com.evil.test/x',
      'https://fcm.googleapis.com:8443/x',
    ])
      expect((await post(bad)).status, bad).toBe(400);
    expect((await post(`https://fcm.googleapis.com/fcm/send/${uuidv7()}`)).status).toBe(200);
    expect((await post(`https://web.push.apple.com/${uuidv7()}`)).status).toBe(200);
    expect((await post(`https://updates.push.services.mozilla.com/wpush/v2/${uuidv7()}`)).status).toBe(200);
  });

  it('keeps at most one pending rest notification and ten devices per user', async () => {
    const u = await user();
    for (let i = 0; i < 12; i++) await call(app, '/api/push/subscriptions', { method: 'POST', cookie: u.cookie, body: sub(uuidv7()) });
    expect(await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.ownerId, u.id))).toHaveLength(10);
    const fireAt = new Date(Date.now() + 60_000).toISOString();
    for (let i = 0; i < 5; i++) await call(app, '/api/push/rest-timer', { method: 'POST', cookie: u.cookie, body: { sessionId: uuidv7(), fireAt } });
    const pending = (await db.select().from(scheduledPushes).where(eq(scheduledPushes.ownerId, u.id))).filter((r) => !r.cancelledAt && !r.sentAt);
    expect(pending).toHaveLength(1);
  });
});
