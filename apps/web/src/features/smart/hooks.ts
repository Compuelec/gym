import { useLiveQuery } from 'dexie-react-hooks';
import { muscleRecovery, personalRecords, type MuscleRecovery, type PersonalRecords } from '@gym/engine';
import type { ExerciseView } from '@/features/catalog/exercises';
import { exerciseHistory, setsSince } from '@/features/training/repo';

const WEEK_MS = 7 * 24 * 3_600_000;

/** Recovery per muscle from the last 7 days of sets (live: updates as sets are logged). */
export function useRecovery(userId: string, exercises: Map<string, ExerciseView>): MuscleRecovery[] | undefined {
  return useLiveQuery(async () => {
    const sets = await setsSince(userId, Date.now() - WEEK_MS);
    return muscleRecovery(
      sets.map((s) => {
        const ex = exercises.get(s.exerciseId);
        return {
          completedAt: s.completedAt,
          primaryMuscles: ex?.primaryMuscles ?? [],
          secondaryMuscles: ex?.secondaryMuscles ?? [],
          warmup: s.type === 'warmup',
        };
      }),
    );
  }, [userId, exercises]);
}

/** The user's records for one exercise (derived locally from history). */
export function useRecords(userId: string, exerciseId: string): PersonalRecords | null | undefined {
  return useLiveQuery(async () => {
    const history = await exerciseHistory(userId, exerciseId);
    const sets = history.flatMap((h) => h.sets);
    return sets.length ? personalRecords(sets) : null;
  }, [userId, exerciseId]);
}
