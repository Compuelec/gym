import { afterAll, describe, expect, it } from 'vitest';
import { uuidv7, type SyncPullResponse, type SyncPushResponse } from '@gym/shared';
import { call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);
afterAll(() => pool.end());

const now = () => new Date().toISOString();
const m = (entity: string, id: string, data: Record<string, unknown>) => ({ mutationId: uuidv7(), entity, op: 'upsert', id, data, clientUpdatedAt: now() });

async function push(cookie: string, mutations: unknown[]) {
  const res = await call(app, '/api/sync/push', { method: 'POST', cookie, body: { clientId: uuidv7(), mutations } });
  return ((await res.json()) as SyncPushResponse).results;
}

const session = { routineId: null, locationId: null, name: 'Pecho', startedAt: now(), endedAt: null, status: 'in_progress', notes: null, perceivedEffort: null };
const sessionExercise = (sessionId: string) => ({ sessionId, position: 0, exerciseId: 'fedb:Pushups', replacedFromExerciseId: null, supersetGroup: null, restSeconds: 90, notes: null });
const set = (sessionExerciseId: string, position = 0) => ({ sessionExerciseId, position, type: 'normal', weightKg: 20, reps: 10, seconds: null, meters: null, rir: 2, rpe: null, completedAt: now(), suggested: { weightKg: 20, reps: 10, reason: 'Igual que la última vez.' } });

describe('workout entities', () => {
  it('a full offline session (session → exercise → sets) syncs in one batch', async () => {
    const { cookie } = await signUp(app);
    const s = uuidv7();
    const se = uuidv7();
    const results = await push(cookie, [m('workoutSession', s, session), m('sessionExercise', se, sessionExercise(s)), m('setEntry', uuidv7(), set(se, 0)), m('setEntry', uuidv7(), set(se, 1))]);
    expect(results.map((r) => r.status)).toEqual(['applied', 'applied', 'applied', 'applied']);
    const page = (await (await call(app, '/api/sync/pull', { cookie })).json()) as SyncPullResponse;
    expect(page.changes.map((c) => c.entity).sort()).toEqual(['sessionExercise', 'setEntry', 'setEntry', 'workoutSession']);
    const setChange = page.changes.find((c) => c.entity === 'setEntry')!;
    expect(setChange.data.suggested).toMatchObject({ reason: 'Igual que la última vez.' });
    expect(setChange.data.completedAt).toMatch(/T.*Z$/);
  });

  it('rejects sets whose exercise does not exist or belongs to someone else', async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    const s = uuidv7();
    const se = uuidv7();
    await push(a.cookie, [m('workoutSession', s, session), m('sessionExercise', se, sessionExercise(s))]);
    const [missing] = await push(a.cookie, [m('setEntry', uuidv7(), set(uuidv7()))]);
    expect(missing?.status === 'rejected' && missing.error.code).toBe('REFERENCE');
    const [foreign] = await push(b.cookie, [m('setEntry', uuidv7(), set(se))]);
    expect(foreign?.status === 'rejected' && foreign.error.code).toBe('REFERENCE');
  });

  it('routines keep their items and validate them', async () => {
    const { cookie } = await signUp(app);
    const item = { position: 0, exerciseId: 'fedb:Pushups', supersetGroup: null, targetSets: 3, repMin: 8, repMax: 12, targetSeconds: null, targetRir: 2, restSeconds: 90, notes: null };
    const routine = { name: 'Empuje', programId: null, weekIndex: null, dayIndex: null, locationId: null, notes: null, items: [item] };
    const [ok] = await push(cookie, [m('routine', uuidv7(), routine)]);
    expect(ok?.status).toBe('applied');
    const [bad] = await push(cookie, [m('routine', uuidv7(), { ...routine, items: [{ ...item, targetSets: 0 }] })]);
    expect(bad?.status).toBe('rejected');
    const page = (await (await call(app, '/api/sync/pull', { cookie })).json()) as SyncPullResponse;
    expect(page.changes[0]?.data.items).toEqual([item]);
  });

  it('editing the same routine from two devices keeps the last one', async () => {
    const { cookie } = await signUp(app);
    const id = uuidv7();
    const routine = (name: string) => ({ name, programId: null, weekIndex: null, dayIndex: null, locationId: null, notes: null, items: [] });
    await push(cookie, [m('routine', id, routine('Teléfono'))]);
    await push(cookie, [m('routine', id, routine('Computador'))]);
    const page = (await (await call(app, '/api/sync/pull', { cookie })).json()) as SyncPullResponse;
    expect(page.changes.filter((c) => c.id === id)).toHaveLength(1);
    expect(page.changes.find((c) => c.id === id)?.data.name).toBe('Computador');
  });
});
