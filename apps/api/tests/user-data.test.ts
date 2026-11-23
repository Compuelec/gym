import { afterAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { uuidv7, type SyncPullResponse } from '@gym/shared';
import { invitations, user, workoutSessions } from '../src/db/schema';
import { call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);
afterAll(() => pool.end());

const now = () => new Date().toISOString();
const m = (entity: string, id: string, data: Record<string, unknown>) => ({ mutationId: uuidv7(), entity, op: 'upsert', id, data, clientUpdatedAt: now() });

async function seedAccount(cookie: string, userId: string) {
  const own = uuidv7();
  const loc = uuidv7();
  const s = uuidv7();
  const se = uuidv7();
  const res = await call(app, '/api/sync/push', {
    method: 'POST',
    cookie,
    body: {
      clientId: uuidv7(),
      mutations: [
        m('profile', userId, { goal: 'strength', level: 'beginner', daysPerWeek: 3, sessionMinutes: 45, units: 'kg', medicalAckAt: now() }),
        m('location', loc, { name: 'Casa', equipment: ['dumbbell'], isDefault: true }),
        m('exercise', own, { nameEs: 'Remo con mochila', instructionsEs: ['Rema'], primaryMuscles: ['middle_back'], secondaryMuscles: [], equipment: [], level: 'beginner', category: 'strength', mechanic: null, force: null, measure: 'reps' }),
        m('favorite', uuidv7(), { exerciseId: own }),
        m('routine', uuidv7(), { name: 'Espalda', programId: null, weekIndex: null, dayIndex: null, locationId: loc, notes: null, items: [{ position: 0, exerciseId: own, supersetGroup: null, targetSets: 3, repMin: 8, repMax: 12, targetSeconds: null, targetRir: null, restSeconds: 60, notes: null }] }),
        m('bodyMeasurement', uuidv7(), { measuredAt: now(), weightKg: 80, bodyFatPct: null, waistCm: 90, chestCm: null, armCm: null, thighCm: null, notes: null }),
        m('workoutSession', s, { routineId: null, locationId: loc, name: 'Espalda', startedAt: now(), endedAt: now(), status: 'completed', notes: null, perceivedEffort: 7 }),
        m('sessionExercise', se, { sessionId: s, position: 0, exerciseId: own, replacedFromExerciseId: null, supersetGroup: null, restSeconds: 60, notes: null }),
        m('setEntry', uuidv7(), { sessionExerciseId: se, position: 0, type: 'normal', weightKg: null, reps: 12, seconds: null, meters: null, rir: null, rpe: null, completedAt: now(), suggested: null }),
      ],
    },
  });
  expect(((await res.json()) as { results: Array<{ status: string }> }).results.every((r) => r.status === 'applied')).toBe(true);
}

const counts = (page: SyncPullResponse) =>
  page.changes.filter((c) => !c.deleted).reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.entity]: (acc[c.entity] ?? 0) + 1 }), {});

describe('export / import', () => {
  it('exports everything nested and in an open format; importing into a new account restores it all (SC-008)', async () => {
    const a = await signUp(app);
    await seedAccount(a.cookie, a.userId);
    const exp = await call(app, '/api/me/export', { cookie: a.cookie });
    expect(exp.headers.get('content-disposition')).toMatch(/attachment; filename="gym-/);
    const file = (await exp.json()) as Record<string, unknown> & { sessions: Array<{ exercises: Array<{ sets: unknown[] }> }> };
    expect(file).toMatchObject({ formatVersion: 1, app: 'gym' });
    expect(file.sessions[0]?.exercises[0]?.sets).toHaveLength(1);
    expect(JSON.stringify(file)).not.toContain('ownerId');

    const b = await signUp(app);
    const imp = await call(app, '/api/me/import', { method: 'POST', cookie: b.cookie, body: file });
    expect(imp.status).toBe(200);
    const before = counts((await (await call(app, '/api/sync/pull', { cookie: a.cookie })).json()) as SyncPullResponse);
    const after = counts((await (await call(app, '/api/sync/pull', { cookie: b.cookie })).json()) as SyncPullResponse);
    expect(after).toEqual(before);

    // References were remapped to the new ids (routine → own exercise, set → session exercise).
    const pulled = (await (await call(app, '/api/sync/pull', { cookie: b.cookie })).json()) as SyncPullResponse;
    const ownEx = pulled.changes.find((c) => c.entity === 'exercise')!;
    const routine = pulled.changes.find((c) => c.entity === 'routine')!;
    expect((routine.data.items as Array<{ exerciseId: string }>)[0]?.exerciseId).toBe(ownEx.id);
    expect(pulled.changes.find((c) => c.entity === 'profile')?.id).toBe(b.userId);
    // Account A untouched.
    expect(counts((await (await call(app, '/api/sync/pull', { cookie: a.cookie })).json()) as SyncPullResponse)).toEqual(before);
  });

  it('rejects invalid files or unknown versions with 422 and changes nothing', async () => {
    const a = await signUp(app);
    await seedAccount(a.cookie, a.userId);
    const file = (await (await call(app, '/api/me/export', { cookie: a.cookie })).json()) as Record<string, unknown> & { routines: Array<Record<string, unknown>> };
    const b = await signUp(app);
    expect((await call(app, '/api/me/import', { method: 'POST', cookie: b.cookie, body: { ...file, formatVersion: 99 } })).status).toBe(422);
    expect((await call(app, '/api/me/import', { method: 'POST', cookie: b.cookie, body: { hola: 1 } })).status).toBe(422);
    // One bad record at the end → nothing at all is imported (transaction).
    const broken = { ...file, routines: [...file.routines, { id: uuidv7(), name: '', items: 'x' }] };
    expect((await call(app, '/api/me/import', { method: 'POST', cookie: b.cookie, body: broken })).status).toBe(422);
    const pulled = (await (await call(app, '/api/sync/pull', { cookie: b.cookie })).json()) as SyncPullResponse;
    expect(pulled.changes).toHaveLength(0);
  });

  it('requires a session', async () => {
    expect((await call(app, '/api/me/export')).status).toBe(401);
    expect((await call(app, '/api/me/import', { method: 'POST', body: {} })).status).toBe(401);
  });
});

describe('delete account', () => {
  it('requires typing BORRAR and the correct password', async () => {
    const a = await signUp(app);
    expect((await call(app, '/api/me', { method: 'DELETE', cookie: a.cookie, body: { confirm: 'borrar', password: 'una-clave-segura' } })).status).toBe(400);
    const wrong = await call(app, '/api/me', { method: 'DELETE', cookie: a.cookie, body: { confirm: 'BORRAR', password: 'otra-clave' } });
    expect(wrong.status).toBe(403);
    expect(((await wrong.json()) as { error: { message: string } }).error.message).toBe('La contraseña no es correcta.');
  });

  it('deletes every row of the user (cascade) and nothing of others; invitation kept without personal data', async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    await seedAccount(a.cookie, a.userId);
    await seedAccount(b.cookie, b.userId);
    const res = await call(app, '/api/me', { method: 'DELETE', cookie: a.cookie, body: { confirm: 'BORRAR', password: 'una-clave-segura' } });
    expect(res.status).toBe(200);
    expect(await db.select().from(user).where(eq(user.id, a.userId))).toHaveLength(0);
    expect(await db.select().from(workoutSessions).where(eq(workoutSessions.ownerId, a.userId))).toHaveLength(0);
    expect(await db.select().from(invitations).where(eq(invitations.usedBy, a.userId))).toHaveLength(0);
    expect(await db.select().from(workoutSessions).where(eq(workoutSessions.ownerId, b.userId))).toHaveLength(1);
    // The old session no longer works.
    expect((await call(app, '/api/sync/pull', { cookie: a.cookie })).status).toBe(401);
  });
});
