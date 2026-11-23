import { formatKg, isWorking, type ExerciseSessionHistory } from './types';

export interface ProgressionTarget {
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
  targetSeconds: number | null;
}

export interface Suggestion {
  weightKg: number | null;
  reps: number | null;
  seconds: number | null;
  reason: string;
}

const KG_PER_LB = 0.45359237;

/** Smallest sensible jump for the equipment, in kg (lb users get 5 lb / 2.5 lb steps). */
export function weightIncrementKg(equipment: readonly string[], units: 'kg' | 'lb'): number {
  const lbStep = (lb: number) => lb * KG_PER_LB;
  if (equipment.includes('barbell') || equipment.includes('ez_bar')) return units === 'kg' ? 2.5 : lbStep(5);
  if (equipment.includes('kettlebell')) return units === 'kg' ? 4 : lbStep(8);
  if (equipment.includes('dumbbell')) return units === 'kg' ? 2 : lbStep(5);
  if (equipment.includes('machine') || equipment.includes('cable')) return units === 'kg' ? 2.5 : lbStep(5);
  return units === 'kg' ? 1 : lbStep(2.5);
}

function roundTo(value: number, step: number) {
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

/**
 * Double progression: work inside the rep range; when every working set reaches the top of the
 * range, add the smallest weight step and go back to the bottom. Two sessions in a row below the
 * range → drop ~10 %. Sets taken to failure (RIR 0) consolidate before adding weight.
 * Every suggestion explains itself in Spanish.
 */
export function suggestNext(opts: {
  measure: 'weight_reps' | 'reps' | 'time' | 'distance';
  equipment: readonly string[];
  target: ProgressionTarget;
  history: ExerciseSessionHistory[]; // newest first
  units: 'kg' | 'lb';
}): Suggestion | null {
  const { measure, equipment, target, history, units } = opts;
  const repMin = target.repMin ?? target.repMax ?? 8;
  const repMax = target.repMax ?? target.repMin ?? 12;
  const last = history[0]?.sets.filter(isWorking) ?? [];

  if (measure === 'time') {
    const best = Math.max(0, ...last.map((s) => s.seconds ?? 0));
    if (!best) return target.targetSeconds ? { weightKg: null, reps: null, seconds: target.targetSeconds, reason: `Primera vez: intenta ${target.targetSeconds} segundos.` } : null;
    const next = best + 5;
    return { weightKg: null, reps: null, seconds: next, reason: `La última vez aguantaste ${best} s: intenta ${next} s.` };
  }

  if (last.length === 0) {
    if (measure === 'weight_reps')
      return { weightKg: null, reps: repMax, seconds: null, reason: `Primera vez: elige un peso con el que hagas ${repMax} repeticiones con buena técnica.` };
    return { weightKg: null, reps: repMax, seconds: null, reason: `Primera vez: apunta a ${repMax} repeticiones.` };
  }

  if (measure === 'reps' || measure === 'distance') {
    const best = Math.max(...last.map((s) => s.reps ?? 0));
    const next = best + 1;
    return { weightKg: null, reps: next, seconds: null, reason: `La última vez hiciste ${best} repeticiones: intenta ${next}.` };
  }

  // weight_reps
  const top = Math.max(...last.map((s) => s.weightKg ?? 0));
  const atTop = last.filter((s) => (s.weightKg ?? 0) === top);
  const reachedTop = last.length >= target.targetSets && atTop.every((s) => (s.reps ?? 0) >= repMax);
  const toFailure = atTop.some((s) => s.rir === 0 || s.type === 'failure');
  const step = weightIncrementKg(equipment, units);

  const missedRange = (sets: typeof last) => sets.some((s) => (s.reps ?? 0) < repMin);
  const prev = history[1]?.sets.filter(isWorking) ?? [];
  const prevTop = Math.max(0, ...prev.map((s) => s.weightKg ?? 0));
  if (missedRange(atTop) && prev.length && prevTop === top && missedRange(prev.filter((s) => (s.weightKg ?? 0) === top))) {
    const lower = Math.max(0, roundTo(top * 0.9, step));
    return {
      weightKg: lower,
      reps: repMin,
      seconds: null,
      reason: `No llegaste a ${repMin} repeticiones dos veces seguidas con ${formatKg(top, units)}: baja a ${formatKg(lower, units)} y recupera la técnica.`,
    };
  }

  if (reachedTop && toFailure) {
    return {
      weightKg: top,
      reps: repMax,
      seconds: null,
      reason: `Completaste ${repMax} repeticiones, pero al fallo: consolida ${formatKg(top, units)} una sesión más antes de subir.`,
    };
  }

  if (reachedTop) {
    const heavier = roundTo(top + step, step / 2);
    return {
      weightKg: heavier,
      reps: repMin,
      seconds: null,
      reason: `Completaste ${atTop.length}×${repMax} con ${formatKg(top, units)}: sube a ${formatKg(heavier, units)} y vuelve a ${repMin} repeticiones.`,
    };
  }

  const bestReps = Math.max(...atTop.map((s) => s.reps ?? 0));
  const reps = Math.min(Math.max(bestReps + 1, repMin), repMax);
  return {
    weightKg: top,
    reps,
    seconds: null,
    reason: `Mantén ${formatKg(top, units)} y busca ${reps} repeticiones en cada serie (rango ${repMin}–${repMax}).`,
  };
}
