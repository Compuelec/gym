import { isWorking, type EngineSet } from './types';

/** Estimated one-rep max: Brzycki up to 10 reps, Epley for 11–12; null outside 1–12 reps. */
export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!weightKg || reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  const est = reps <= 10 ? (weightKg * 36) / (37 - reps) : weightKg * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

export type RecordKind = 'max_weight' | 'max_reps' | 'est_1rm' | 'max_volume';

export interface PersonalRecords {
  max_weight: number;
  max_reps: number;
  est_1rm: number;
  max_volume: number;
}

export function personalRecords(sets: EngineSet[]): PersonalRecords {
  const working = sets.filter(isWorking);
  return {
    max_weight: Math.max(0, ...working.map((s) => s.weightKg ?? 0)),
    max_reps: Math.max(0, ...working.map((s) => s.reps ?? 0)),
    est_1rm: Math.max(0, ...working.map((s) => estimateOneRepMax(s.weightKg ?? 0, s.reps ?? 0) ?? 0)),
    max_volume: Math.max(0, ...working.map((s) => (s.weightKg ?? 0) * (s.reps ?? 0))),
  };
}

/**
 * Records a new set beats compared to everything before it. Warm-ups never count, and the very
 * first time an exercise is logged is not celebrated as a record.
 */
export function newRecords(previous: EngineSet[], set: EngineSet): RecordKind[] {
  if (!isWorking(set) || previous.filter(isWorking).length === 0) return [];
  const before = personalRecords(previous);
  const now = personalRecords([set]);
  const kinds: RecordKind[] = [];
  if ((set.weightKg ?? 0) > 0) {
    if (now.max_weight > before.max_weight) kinds.push('max_weight');
    if (now.est_1rm > before.est_1rm) kinds.push('est_1rm');
    if (now.max_volume > before.max_volume) kinds.push('max_volume');
  } else if (now.max_reps > before.max_reps) {
    kinds.push('max_reps');
  }
  return kinds;
}
