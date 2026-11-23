import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { uuidv7, type SyncPullResponse, type SyncPushResponse } from '@gym/shared';
import { user } from '../src/db/schema';
import { call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);
afterAll(() => pool.end());

const profile = {
  goal: 'strength',
  level: 'beginner',
  daysPerWeek: 3,
  sessionMinutes: 45,
  units: 'kg',
  medicalAckAt: new Date().toISOString(),
};

async function push(cookie: string, entity: string, id: string, data: Record<string, unknown>) {
  const res = await call(app, '/api/sync/push', {
    method: 'POST',
    cookie,
    body: {
      clientId: uuidv7(),
      mutations: [{ mutationId: uuidv7(), entity, op: 'upsert', id, data, clientUpdatedAt: new Date().toISOString() }],
    },
  });
  return ((await res.json()) as SyncPushResponse).results[0]!;
}

async function pull(cookie: string) {
  return (await (await call(app, '/api/sync/pull', { cookie })).json()) as SyncPullResponse;
}

describe('profile', () => {
  it('is stored with the user id and synced back', async () => {
    const { cookie, userId } = await signUp(app);
    expect((await push(cookie, 'profile', userId, profile)).status).toBe('applied');
    const page = await pull(cookie);
    expect(page.changes).toEqual([expect.objectContaining({ entity: 'profile', id: userId })]);
    expect(page.changes[0]?.data).toMatchObject({ goal: 'strength', daysPerWeek: 3 });
  });

  it('rejects a profile whose id is not the user id', async () => {
    const { cookie } = await signUp(app);
    const r = await push(cookie, 'profile', uuidv7(), profile);
    expect(r.status === 'rejected' && r.error.code).toBe('VALIDATION');
  });

  it('two devices onboarding offline converge on one profile (last write wins)', async () => {
    const { cookie, userId } = await signUp(app);
    await push(cookie, 'profile', userId, { ...profile, daysPerWeek: 2 });
    await push(cookie, 'profile', userId, { ...profile, daysPerWeek: 5 });
    const profiles = (await pull(cookie)).changes.filter((c) => c.entity === 'profile');
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.data.daysPerWeek).toBe(5);
  });

  it('round trip: a pulled profile can be pushed back unchanged (dates come back as ISO)', async () => {
    const { cookie, userId } = await signUp(app);
    await push(cookie, 'profile', userId, profile);
    const pulled = (await pull(cookie)).changes[0]!;
    expect(pulled.data.medicalAckAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(pulled.data.createdAt).toMatch(/T.*Z$/);
    const again = await push(cookie, 'profile', userId, { ...pulled.data, sessionMinutes: 60 });
    expect(again.status).toBe('applied');
    expect((await pull(cookie)).changes[0]?.data.sessionMinutes).toBe(60);
  });

  it('validates ranges', async () => {
    const { cookie, userId } = await signUp(app);
    const r = await push(cookie, 'profile', userId, { ...profile, daysPerWeek: 9 });
    expect(r.status).toBe('rejected');
  });

  it('cannot change the role through sync', async () => {
    const { cookie, userId } = await signUp(app);
    await push(cookie, 'profile', userId, { ...profile, role: 'admin' });
    const [u] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId));
    expect(u?.role).toBe('user');
  });
});

describe('location', () => {
  it('saves equipment and isolates users', async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    const id = uuidv7();
    expect((await push(a.cookie, 'location', id, { name: 'Casa', equipment: ['dumbbell', 'band'], isDefault: true })).status).toBe('applied');
    expect((await pull(a.cookie)).changes[0]?.data).toMatchObject({ name: 'Casa', equipment: ['dumbbell', 'band'] });
    const r = await push(b.cookie, 'location', id, { name: 'Robada', equipment: [], isDefault: false });
    expect(r.status === 'rejected' && r.error.code).toBe('NOT_FOUND');
    expect((await pull(b.cookie)).changes).toHaveLength(0);
  });

  it('rejects unknown equipment', async () => {
    const { cookie } = await signUp(app);
    const r = await push(cookie, 'location', uuidv7(), { name: 'Casa', equipment: ['laser'], isDefault: true });
    expect(r.status).toBe('rejected');
  });
});
