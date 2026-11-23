import { describe, expect, it } from 'vitest';
import { estimateOneRepMax, newRecords, personalRecords } from './records';
import type { EngineSet } from './types';

const s = (weightKg: number | null, reps: number, type: EngineSet['type'] = 'normal'): EngineSet => ({ weightKg, reps, seconds: null, rir: null, type });

describe('estimateOneRepMax', () => {
  it('uses Brzycki up to 10 reps and Epley for 11–12', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 5)).toBe(112.5); // 100·36/32
    expect(estimateOneRepMax(100, 12)).toBe(140); // 100·(1+12/30)
  });
  it('only for 1–12 reps', () => {
    expect(estimateOneRepMax(100, 13)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
  });
});

describe('personal records', () => {
  it('computes max weight, reps, estimated 1RM and volume from working sets', () => {
    const r = personalRecords([s(100, 5), s(80, 10), s(140, 1, 'warmup')]);
    expect(r).toEqual({ max_weight: 100, max_reps: 10, est_1rm: 112.5, max_volume: 800 });
  });

  it('detects the records a new set breaks', () => {
    const before = [s(100, 5), s(80, 10)];
    expect(newRecords(before, s(102.5, 5))).toEqual(['max_weight', 'est_1rm']); // 512,5 kg < 800 kg of volume
    expect(newRecords(before, s(90, 10))).toEqual(['est_1rm', 'max_volume']);
    expect(newRecords(before, s(60, 8))).toEqual([]);
  });

  it('bodyweight exercises celebrate more reps', () => {
    expect(newRecords([s(null, 12)], s(null, 15))).toEqual(['max_reps']);
  });

  it('never for warm-ups or the very first time', () => {
    expect(newRecords([s(100, 5)], s(200, 5, 'warmup'))).toEqual([]);
    expect(newRecords([], s(50, 5))).toEqual([]);
  });
});
