import { describe, expect, it } from 'vitest';
import { muscleRecovery, type TrainedSet } from './recovery';

const NOW = Date.parse('2026-11-23T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const sets = (n: number, h: number, primary: string[], secondary: string[] = [], warmup = false): TrainedSet[] =>
  Array.from({ length: n }, () => ({ completedAt: hoursAgo(h), primaryMuscles: primary, secondaryMuscles: secondary, warmup }));

const of = (list: ReturnType<typeof muscleRecovery>, m: string) => list.find((r) => r.muscle === m)!;

describe('muscleRecovery', () => {
  it('heavy leg day yesterday → quadriceps fatigued, chest recovered', () => {
    const r = muscleRecovery(sets(10, 20, ['quadriceps'], ['glutes']), NOW);
    expect(of(r, 'quadriceps').status).toBe('fatigued');
    expect(of(r, 'glutes').status).toBe('partial');
    expect(of(r, 'chest')).toMatchObject({ status: 'recovered', fatigue: 0, lastTrainedAt: null });
  });

  it('fatigue halves after the half-life (large muscles 48 h, small 24 h)', () => {
    expect(of(muscleRecovery(sets(8, 48, ['quadriceps']), NOW), 'quadriceps').fatigue).toBeCloseTo(4, 1);
    expect(of(muscleRecovery(sets(8, 24, ['biceps']), NOW), 'biceps').fatigue).toBeCloseTo(4, 1);
  });

  it('counts secondary muscles half and ignores warm-ups', () => {
    const r = muscleRecovery([...sets(4, 0, ['chest'], ['triceps']), ...sets(10, 0, ['triceps'], [], true)], NOW);
    expect(of(r, 'triceps').fatigue).toBe(2);
    expect(of(r, 'triceps').weeklySets).toBe(2);
  });

  it('weekly sets only count the last 7 days', () => {
    const r = muscleRecovery([...sets(3, 24 * 3, ['lats']), ...sets(5, 24 * 9, ['lats'])], NOW);
    expect(of(r, 'lats').weeklySets).toBe(3);
  });
});
