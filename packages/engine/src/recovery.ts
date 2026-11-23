import { MUSCLES } from '@gym/shared';

export interface TrainedSet {
  completedAt: string; // ISO
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  warmup: boolean;
}

export type RecoveryStatus = 'recovered' | 'partial' | 'fatigued';

export interface MuscleRecovery {
  muscle: string;
  fatigue: number;
  status: RecoveryStatus;
  lastTrainedAt: string | null;
  weeklySets: number;
}

/** Hours for the fatigue of one set to halve, by muscle size. */
export const HALF_LIFE_HOURS = { small: 24, medium: 36, large: 48 } as const;
export const FATIGUED_AT = 6;
export const PARTIAL_AT = 3;

/**
 * Fatigue per muscle: each effective set counts 1 for primary and 0.5 for secondary muscles,
 * decaying exponentially with a half-life by muscle size. Above 6 → fatigued, above 3 → partial.
 */
export function muscleRecovery(sets: TrainedSet[], now = Date.now()): MuscleRecovery[] {
  return MUSCLES.map((m) => {
    const halfLife = HALF_LIFE_HOURS[m.size];
    let fatigue = 0;
    let weeklySets = 0;
    let last: string | null = null;
    for (const s of sets) {
      if (s.warmup) continue;
      const weight = s.primaryMuscles.includes(m.slug) ? 1 : s.secondaryMuscles.includes(m.slug) ? 0.5 : 0;
      if (!weight) continue;
      const hours = (now - Date.parse(s.completedAt)) / 3_600_000;
      if (hours < 0) continue;
      if (hours <= 24 * 7) weeklySets += weight;
      fatigue += weight * Math.pow(0.5, hours / halfLife);
      if (!last || s.completedAt > last) last = s.completedAt;
    }
    fatigue = Math.round(fatigue * 100) / 100;
    const status: RecoveryStatus = fatigue >= FATIGUED_AT ? 'fatigued' : fatigue >= PARTIAL_AT ? 'partial' : 'recovered';
    return { muscle: m.slug, fatigue, status, lastTrainedAt: last, weeklySets };
  });
}
