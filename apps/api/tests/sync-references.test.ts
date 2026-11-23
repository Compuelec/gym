import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { uuidv7, type SyncPushResponse } from '@gym/shared';
import { programs } from '../src/db/schema';
import { call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);
afterAll(() => pool.end());

const now = () => new Date().toISOString();
const m = (entity: string, id: string, data: Record<string, unknown>, op = 'upsert') => ({ mutationId: uuidv7(), entity, op, id, data, clientUpdatedAt: now() });
async function push(cookie: string, mutations: unknown[]) {
  const res = await call(app, '/api/sync/push', { method: 'POST', cookie, body: { clientId: uuidv7(), mutations } });
  return ((await res.json()) as SyncPushResponse).results.map((r) => (r.status === 'rejected' ? r.error.code : r.status));
}
const location = { name: 'Casa', equipment: [], isDefault: false };
const ownExercise = { nameEs: 'Mío', primaryMuscles: ['chest'], secondaryMuscles: [], equipment: [], level: 'beginner', category: 'strength', mechanic: null, force: null, measure: 'reps', instructionsEs: [], notes: null };
const item = (exerciseId: string) => ({ position: 0, exerciseId, supersetGroup: null, targetSets: 3, repMin: 8, repMax: 12, targetSeconds: null, targetRir: null, restSeconds: 90, notes: null });
const routine = (o: Record<string, unknown>) => ({ name: 'R', programId: null, weekIndex: null, dayIndex: null, locationId: null, notes: null, items: [item('fedb:Pushups')], ...o });
const session = (o: Record<string, unknown>) => ({ routineId: null, locationId: null, name: 'S', startedAt: now(), endedAt: null, status: 'in_progress', notes: null, perceivedEffort: null, ...o });

describe('references always belong to the same owner', () => {
  it("rejects pointing at another user's location, routine or own exercise", async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    const loc = uuidv7();
    const ex = uuidv7();
    const r = uuidv7();
    expect(await push(a.cookie, [m('location', loc, location), m('exercise', ex, ownExercise), m('routine', r, routine({}))])).toEqual(['applied', 'applied', 'applied']);

    expect(await push(b.cookie, [m('routine', uuidv7(), routine({ locationId: loc }))])).toEqual(['REFERENCE']);
    expect(await push(b.cookie, [m('routine', uuidv7(), routine({ items: [item(ex)] }))])).toEqual(['REFERENCE']);
    expect(await push(b.cookie, [m('workoutSession', uuidv7(), session({ routineId: r }))])).toEqual(['REFERENCE']);
    expect(await push(b.cookie, [m('favorite', uuidv7(), { exerciseId: ex })])).toEqual(['REFERENCE']);
    // Catalog ids and own rows are fine.
    expect(await push(a.cookie, [m('favorite', uuidv7(), { exerciseId: ex }), m('favorite', uuidv7(), { exerciseId: 'fedb:Pushups' })])).toEqual(['applied', 'applied']);
  });

  it('accepts own rows deleted meanwhile (finishing offline a session whose location was deleted)', async () => {
    const a = await signUp(app);
    const loc = uuidv7();
    const s = uuidv7();
    await push(a.cookie, [m('location', loc, location), m('workoutSession', s, session({ locationId: loc }))]);
    await push(a.cookie, [m('location', loc, {}, 'delete')]);
    expect(await push(a.cookie, [m('workoutSession', s, session({ locationId: loc, status: 'completed', endedAt: now() }))])).toEqual(['applied']);
  });

  it('clients cannot set coachRequestId (only the server does when accepting)', async () => {
    const a = await signUp(app);
    const p = uuidv7();
    expect(await push(a.cookie, [m('program', p, { name: 'P', weeks: 4, source: 'user', coachRequestId: uuidv7() })])).toEqual(['applied']);
    const [row] = await db.select().from(programs).where(eq(programs.id, p));
    expect(row?.coachRequestId).toBeNull();
  });
});
