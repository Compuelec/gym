import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from '@gym/shared';
import { getDB } from '@/db/database';
import { addExercisesToRoutine, addSessionExercise, hasActiveSession, saveRoutine, startSession, swapSessionExercise, updateSessionTargets, type LocalRoutine, type LocalSessionExercise } from './repo';

async function setup() {
  const userId = uuidv7();
  const id = await addSessionExercise(userId, uuidv7(), 'fedb:Pushups', 90, null, 0, false);
  const db = getDB(userId);
  const se = (await db.entityTable('sessionExercise').get(id)) as unknown as LocalSessionExercise;
  // The training card hands the exercise over together with its logged sets.
  return { userId, db, se: { ...se, sets: [{ id: 'x' }] } };
}

describe('session exercise changes', () => {
  it('changes sets, reps and rest for this session only, without storing the card sets', async () => {
    const { userId, db, se } = await setup();
    await updateSessionTargets(userId, se, { targetSets: 4, repMin: 6, repMax: 8, targetSeconds: null, restSeconds: 120 });
    const saved = (await db.entityTable('sessionExercise').get(se.id)) as Record<string, unknown>;
    expect(saved).toMatchObject({ targetSets: 4, repMin: 6, repMax: 8, restSeconds: 120, exerciseId: 'fedb:Pushups' });
    expect(saved).not.toHaveProperty('sets');
    const queued = (await db.outbox.toArray()).at(-1)!;
    expect(queued.data).not.toHaveProperty('sets');
  });

  it('swaps the exercise and remembers the original one', async () => {
    const { userId, db, se } = await setup();
    await swapSessionExercise(userId, se, 'fedb:Push-Ups_-_Close_Triceps_Position');
    const saved = (await db.entityTable('sessionExercise').get(se.id)) as Record<string, unknown>;
    expect(saved).toMatchObject({ exerciseId: 'fedb:Push-Ups_-_Close_Triceps_Position', replacedFromExerciseId: 'fedb:Pushups' });
    expect(saved).not.toHaveProperty('sets');
  });
});

describe('active session (holds app updates back)', () => {
  it('counts a workout in progress, but not one forgotten for more than 6 hours', async () => {
    const userId = uuidv7();
    expect(await hasActiveSession(userId)).toBe(false);
    await startSession(userId, { name: 'Libre', locationId: null });
    expect(await hasActiveSession(userId)).toBe(true);
    expect(await hasActiveSession(userId, Date.now() + 7 * 60 * 60 * 1000)).toBe(false);
  });
});

describe('add exercises to a routine (from the catalog)', () => {
  it('appends with default targets, skips the ones already there and never passes 30', async () => {
    const userId = uuidv7();
    const routine: LocalRoutine = { id: uuidv7(), name: 'Tren superior', programId: null, weekIndex: null, dayIndex: null, locationId: null, notes: null, items: [] };
    await saveRoutine(userId, routine);
    expect(await addExercisesToRoutine(userId, routine, [{ id: 'fedb:Pushups', measure: 'reps' }, { id: 'fedb:Plank', measure: 'time' }])).toBe(2);
    const db = getDB(userId);
    const saved = (await db.entityTable('routine').get(routine.id)) as unknown as LocalRoutine;
    expect(saved.items.map((i) => [i.exerciseId, i.position, i.targetSets])).toEqual([
      ['fedb:Pushups', 0, 3],
      ['fedb:Plank', 1, 3],
    ]);
    expect(saved.items[1]!.targetSeconds).not.toBeNull();
    // Already there: nothing changes.
    expect(await addExercisesToRoutine(userId, saved, [{ id: 'fedb:Pushups', measure: 'reps' }])).toBe(0);
    // Room for 28 more only.
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `own-${i}`, measure: 'reps' }));
    expect(await addExercisesToRoutine(userId, saved, many)).toBe(28);
  });
});
