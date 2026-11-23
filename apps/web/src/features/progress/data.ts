import { useLiveQuery } from 'dexie-react-hooks';
import type { BodyMeasurement } from '@gym/shared';
import { getDB } from '@/db/database';
import { deleteRecord, saveRecord } from '@/db/sync';
import type { LocalSession, LocalSessionExercise, LocalSet } from '@/features/training/repo';
import { getSyncEngine } from '@/lib/sync-client';

export type LocalMeasurement = BodyMeasurement & { id: string };

export interface CompletedSession extends LocalSession {
  exercises: Array<LocalSessionExercise & { sets: LocalSet[] }>;
}

/** All completed sessions with exercises and sets, newest first. */
export function useCompletedSessions(userId: string) {
  return useLiveQuery(async (): Promise<CompletedSession[]> => {
    const db = getDB(userId);
    const sessions = ((await db.entityTable('workoutSession').where('status').equals('completed').toArray()) as unknown as LocalSession[]).sort((a, b) =>
      b.startedAt.localeCompare(a.startedAt),
    );
    const ses = (await db.entityTable('sessionExercise').toArray()) as unknown as LocalSessionExercise[];
    const sets = (await db.entityTable('setEntry').toArray()) as unknown as LocalSet[];
    const setsBySe = new Map<string, LocalSet[]>();
    for (const s of sets) setsBySe.set(s.sessionExerciseId, [...(setsBySe.get(s.sessionExerciseId) ?? []), s]);
    return sessions.map((s) => ({
      ...s,
      exercises: ses
        .filter((se) => se.sessionId === s.id)
        .sort((a, b) => a.position - b.position)
        .map((se) => ({ ...se, sets: (setsBySe.get(se.id) ?? []).sort((a, b) => a.position - b.position) })),
    }));
  }, [userId]);
}

export function useMeasurements(userId: string) {
  return useLiveQuery(
    async () =>
      ((await getDB(userId).entityTable('bodyMeasurement').toArray()) as unknown as LocalMeasurement[]).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)),
    [userId],
  );
}

export async function saveMeasurement(userId: string, m: LocalMeasurement) {
  await saveRecord(getDB(userId), 'bodyMeasurement', m);
  void getSyncEngine(userId).sync();
}

export async function deleteMeasurement(userId: string, id: string) {
  await deleteRecord(getDB(userId), 'bodyMeasurement', id);
  void getSyncEngine(userId).sync();
}
