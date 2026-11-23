import { useLiveQuery } from 'dexie-react-hooks';
import {
  uuidv7,
  type Routine,
  type RoutineItem,
  type SessionExercise,
  type SetEntry,
  type WorkoutSession,
} from '@gym/shared';
import { getDB } from '@/db/database';
import { deleteRecord, saveRecord } from '@/db/sync';
import { getSyncEngine } from '@/lib/sync-client';

export type LocalRoutine = Routine & { id: string };
export type LocalSession = WorkoutSession & { id: string };
export type LocalSessionExercise = SessionExercise & { id: string };
export type LocalSet = SetEntry & { id: string };

const sync = (userId: string) => void getSyncEngine(userId).sync();

// ── Routines ────────────────────────────────────────────────────────────────

export function useRoutines(userId: string) {
  return useLiveQuery(
    async () =>
      ((await getDB(userId).entityTable('routine').toArray()) as unknown as LocalRoutine[]).sort((a, b) =>
        a.name.localeCompare(b.name, 'es'),
      ),
    [userId],
  );
}

export function useRoutine(userId: string, id: string) {
  return useLiveQuery(async () => ((await getDB(userId).entityTable('routine').get(id)) as unknown as LocalRoutine) ?? null, [userId, id]);
}

export async function saveRoutine(userId: string, routine: LocalRoutine) {
  const items = routine.items.map((item, position) => ({ ...item, position }));
  await saveRecord(getDB(userId), 'routine', { ...routine, items });
  sync(userId);
}

export async function deleteRoutine(userId: string, id: string) {
  await deleteRecord(getDB(userId), 'routine', id);
  sync(userId);
}

export async function duplicateRoutine(userId: string, routine: LocalRoutine, suffix: string) {
  const copy: LocalRoutine = { ...routine, id: uuidv7(), name: `${routine.name} ${suffix}`.slice(0, 60) };
  delete (copy as Partial<LocalRoutine> & { serverVersion?: number }).serverVersion;
  await saveRoutine(userId, copy);
  return copy.id;
}

export function emptyItem(exerciseId: string, measure: string): RoutineItem {
  const timed = measure === 'time';
  return {
    position: 0,
    exerciseId,
    supersetGroup: null,
    targetSets: 3,
    repMin: timed ? null : 8,
    repMax: timed ? null : 12,
    targetSeconds: timed ? 30 : null,
    targetRir: null,
    restSeconds: 90,
    notes: null,
  };
}

// ── Sessions ────────────────────────────────────────────────────────────────

export function useActiveSession(userId: string) {
  return useLiveQuery(async () => {
    const list = (await getDB(userId).entityTable('workoutSession').where('status').equals('in_progress').toArray()) as unknown as LocalSession[];
    return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] ?? null;
  }, [userId]);
}

/** Starts a session from a routine (copying its exercises) or empty. Works offline. */
export async function startSession(
  userId: string,
  opts: { name: string; routine?: LocalRoutine | null; locationId: string | null },
): Promise<string> {
  const db = getDB(userId);
  const sessionId = uuidv7();
  const session: LocalSession = {
    id: sessionId,
    routineId: opts.routine?.id ?? null,
    locationId: opts.locationId,
    name: opts.name,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'in_progress',
    notes: null,
    perceivedEffort: null,
  };
  await saveRecord(db, 'workoutSession', session);
  for (const item of [...(opts.routine?.items ?? [])].sort((a, b) => a.position - b.position)) {
    await addSessionExercise(userId, sessionId, item.exerciseId, item.restSeconds, item.supersetGroup, item.position, false);
  }
  sync(userId);
  return sessionId;
}

export async function addSessionExercise(
  userId: string,
  sessionId: string,
  exerciseId: string,
  restSeconds = 90,
  supersetGroup: string | null = null,
  position?: number,
  doSync = true,
) {
  const db = getDB(userId);
  const count = await db.entityTable('sessionExercise').where('sessionId').equals(sessionId).count();
  const se: LocalSessionExercise = {
    id: uuidv7(),
    sessionId,
    position: position ?? count,
    exerciseId,
    replacedFromExerciseId: null,
    supersetGroup,
    restSeconds,
    notes: null,
  };
  await saveRecord(db, 'sessionExercise', se);
  if (doSync) sync(userId);
  return se.id;
}

export async function swapSessionExercise(userId: string, se: LocalSessionExercise, newExerciseId: string) {
  await saveRecord(getDB(userId), 'sessionExercise', {
    ...se,
    exerciseId: newExerciseId,
    replacedFromExerciseId: se.replacedFromExerciseId ?? se.exerciseId,
  });
  sync(userId);
}

export interface SessionDetail {
  session: LocalSession;
  exercises: Array<LocalSessionExercise & { sets: LocalSet[] }>;
}

export function useSessionDetail(userId: string, sessionId: string) {
  return useLiveQuery(async (): Promise<SessionDetail | null> => {
    const db = getDB(userId);
    const session = (await db.entityTable('workoutSession').get(sessionId)) as unknown as LocalSession | undefined;
    if (!session) return null;
    const exercises = ((await db.entityTable('sessionExercise').where('sessionId').equals(sessionId).toArray()) as unknown as LocalSessionExercise[]).sort(
      (a, b) => a.position - b.position,
    );
    const withSets = await Promise.all(
      exercises.map(async (se) => ({
        ...se,
        sets: ((await db.entityTable('setEntry').where('sessionExerciseId').equals(se.id).toArray()) as unknown as LocalSet[]).sort(
          (a, b) => a.position - b.position,
        ),
      })),
    );
    return { session, exercises: withSets };
  }, [userId, sessionId]);
}

export async function logSet(userId: string, set: Omit<LocalSet, 'id' | 'completedAt'> & { id?: string }) {
  const entry: LocalSet = { ...set, id: set.id ?? uuidv7(), completedAt: new Date().toISOString() };
  await saveRecord(getDB(userId), 'setEntry', entry);
  sync(userId);
  return entry;
}

export async function deleteSet(userId: string, id: string) {
  await deleteRecord(getDB(userId), 'setEntry', id);
  sync(userId);
}

export async function finishSession(userId: string, session: LocalSession, patch: Partial<LocalSession> = {}) {
  await saveRecord(getDB(userId), 'workoutSession', { ...session, ...patch, status: 'completed', endedAt: new Date().toISOString() });
  sync(userId);
}

export async function discardSession(userId: string, session: LocalSession) {
  await saveRecord(getDB(userId), 'workoutSession', { ...session, status: 'discarded', endedAt: new Date().toISOString() });
  sync(userId);
}

/**
 * Sets done for an exercise in the most recent completed session (to prefill the next one).
 */
export async function lastPerformance(userId: string, exerciseId: string, excludeSessionId?: string): Promise<LocalSet[]> {
  const db = getDB(userId);
  const ses = (await db.entityTable('sessionExercise').where('exerciseId').equals(exerciseId).toArray()) as unknown as LocalSessionExercise[];
  let best: { at: string; seId: string } | null = null;
  for (const se of ses) {
    if (se.sessionId === excludeSessionId) continue;
    const s = (await db.entityTable('workoutSession').get(se.sessionId)) as unknown as LocalSession | undefined;
    if (!s || s.status !== 'completed') continue;
    if (!best || s.startedAt > best.at) best = { at: s.startedAt, seId: se.id };
  }
  if (!best) return [];
  return ((await db.entityTable('setEntry').where('sessionExerciseId').equals(best.seId).toArray()) as unknown as LocalSet[]).sort(
    (a, b) => a.position - b.position,
  );
}

/** Sessions in progress for more than 6 hours (probably forgotten). */
export const STALE_SESSION_MS = 6 * 60 * 60 * 1000;
export function isStale(session: Pick<WorkoutSession, 'startedAt' | 'status'>, now = Date.now()) {
  return session.status === 'in_progress' && now - Date.parse(session.startedAt) > STALE_SESSION_MS;
}
