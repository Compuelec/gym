/** A logged set as the engine sees it (weights always in kg). */
export interface EngineSet {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  rir: number | null;
  type: 'warmup' | 'normal' | 'failure' | 'drop';
}

/** One past session of an exercise, newest first in lists. */
export interface ExerciseSessionHistory {
  date: string; // ISO
  sets: EngineSet[];
}

export const isWorking = (s: EngineSet) => s.type !== 'warmup';

export function formatKg(kg: number, units: 'kg' | 'lb'): string {
  const value = units === 'kg' ? kg : kg / 0.45359237;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('es', { maximumFractionDigits: 1 })} ${units}`;
}
