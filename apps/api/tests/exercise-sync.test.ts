import { afterAll, describe, expect, it } from 'vitest';
import { uuidv7, type SyncPullResponse, type SyncPushResponse } from '@gym/shared';
import { call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);
afterAll(() => pool.end());

const own = {
  nameEs: 'Remo con mochila',
  instructionsEs: ['Llena una mochila.', 'Rema hacia el abdomen.'],
  primaryMuscles: ['middle_back'],
  secondaryMuscles: ['biceps'],
  equipment: [],
  level: 'beginner',
  category: 'strength',
  mechanic: 'compound',
  force: 'pull',
  measure: 'reps',
};

async function push(cookie: string, entity: string, id: string, data: Record<string, unknown>) {
  const res = await call(app, '/api/sync/push', {
    method: 'POST',
    cookie,
    body: { clientId: uuidv7(), mutations: [{ mutationId: uuidv7(), entity, op: 'upsert', id, data, clientUpdatedAt: new Date().toISOString() }] },
  });
  return ((await res.json()) as SyncPushResponse).results[0]!;
}
const pull = async (cookie: string) => (await (await call(app, '/api/sync/pull', { cookie })).json()) as SyncPullResponse;

describe('own exercises and favorites', () => {
  it('stores a private exercise only visible to its owner', async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    const id = uuidv7();
    expect((await push(a.cookie, 'exercise', id, own)).status).toBe('applied');
    expect((await pull(a.cookie)).changes[0]?.data).toMatchObject({ nameEs: 'Remo con mochila', primaryMuscles: ['middle_back'] });
    expect((await pull(b.cookie)).changes).toHaveLength(0);
    const r = await push(b.cookie, 'exercise', id, { ...own, nameEs: 'Robado' });
    expect(r.status === 'rejected' && r.error.code).toBe('NOT_FOUND');
  });

  it('validates muscles, equipment and measure', async () => {
    const { cookie } = await signUp(app);
    for (const bad of [{ primaryMuscles: [] }, { primaryMuscles: ['wings'] }, { equipment: ['jetpack'] }, { measure: 'vibes' }, { nameEs: '' }]) {
      expect((await push(cookie, 'exercise', uuidv7(), { ...own, ...bad })).status).toBe('rejected');
    }
  });

  it('favorites a catalog exercise and syncs it', async () => {
    const { cookie } = await signUp(app);
    expect((await push(cookie, 'favorite', uuidv7(), { exerciseId: 'fedb:Pushups' })).status).toBe('applied');
    expect((await pull(cookie)).changes[0]).toMatchObject({ entity: 'favorite', data: { exerciseId: 'fedb:Pushups' } });
  });
});
