import { describe, expect, it } from 'vitest';
import { suggestNext, weightIncrementKg } from './progression';
import type { EngineSet, ExerciseSessionHistory } from './types';

const s = (weightKg: number | null, reps: number | null, extra: Partial<EngineSet> = {}): EngineSet => ({ weightKg, reps, seconds: null, rir: 2, type: 'normal', ...extra });
const session = (date: string, sets: EngineSet[]): ExerciseSessionHistory => ({ date, sets });
const target = { targetSets: 3, repMin: 8, repMax: 10, targetSeconds: null };
const base = { measure: 'weight_reps' as const, equipment: ['barbell'], target, units: 'kg' as const };

describe('suggestNext (double progression)', () => {
  it('first time: asks for a weight that allows the top of the range', () => {
    const r = suggestNext({ ...base, history: [] });
    expect(r).toMatchObject({ weightKg: null, reps: 10 });
    expect(r?.reason).toMatch(/Primera vez/);
  });

  it('all sets at the top of the range → add the barbell step and go back to the bottom', () => {
    const r = suggestNext({ ...base, history: [session('2026-11-20', [s(60, 10), s(60, 10), s(60, 10)])] });
    expect(r).toMatchObject({ weightKg: 62.5, reps: 8 });
    expect(r?.reason).toBe('Completaste 3×10 con 60 kg: sube a 62,5 kg y vuelve a 8 repeticiones.');
  });

  it('dumbbells and kettlebells use their own steps; lb users get 5 lb', () => {
    expect(weightIncrementKg(['dumbbell'], 'kg')).toBe(2);
    expect(weightIncrementKg(['kettlebell'], 'kg')).toBe(4);
    expect(weightIncrementKg(['barbell'], 'lb')).toBeCloseTo(2.268, 3);
  });

  it('inside the range → keep the weight and add one rep', () => {
    const r = suggestNext({ ...base, history: [session('2026-11-20', [s(60, 9), s(60, 8), s(60, 8)])] });
    expect(r).toMatchObject({ weightKg: 60, reps: 10 });
    expect(r?.reason).toMatch(/Mantén 60 kg y busca 10 repeticiones/);
  });

  it('below the range two sessions in a row → drop about 10 %', () => {
    const history = [session('2026-11-20', [s(60, 6), s(60, 5)]), session('2026-11-17', [s(60, 7), s(60, 6)])];
    const r = suggestNext({ ...base, history });
    expect(r).toMatchObject({ weightKg: 55, reps: 8 });
    expect(r?.reason).toMatch(/dos veces seguidas/);
  });

  it('one bad session is not enough to drop', () => {
    const history = [session('2026-11-20', [s(60, 6), s(60, 6), s(60, 6)]), session('2026-11-17', [s(60, 9), s(60, 9), s(60, 8)])];
    expect(suggestNext({ ...base, history })?.weightKg).toBe(60);
  });

  it('reaching the top only at failure (RIR 0) → consolidate before adding', () => {
    const r = suggestNext({ ...base, history: [session('2026-11-20', [s(60, 10), s(60, 10), s(60, 10, { rir: 0 })])] });
    expect(r?.weightKg).toBe(60);
    expect(r?.reason).toMatch(/al fallo/);
  });

  it('ignores warm-up sets', () => {
    const r = suggestNext({ ...base, history: [session('2026-11-20', [s(20, 10, { type: 'warmup' }), s(60, 10), s(60, 10), s(60, 10)])] });
    expect(r?.weightKg).toBe(62.5);
  });

  it('bodyweight (reps) and timed exercises progress by one rep / five seconds', () => {
    expect(suggestNext({ ...base, measure: 'reps', equipment: [], history: [session('d', [s(null, 12), s(null, 15)])] })).toMatchObject({ reps: 16 });
    const timed = suggestNext({ ...base, measure: 'time', equipment: [], history: [session('d', [{ ...s(null, null), seconds: 40 }])] });
    expect(timed).toMatchObject({ seconds: 45, reason: 'La última vez aguantaste 40 s: intenta 45 s.' });
  });
});
