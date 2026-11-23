import { describe, expect, it } from 'vitest';
import { exerciseSeries, volumeByGroup, weekStart, weeklyFrequency, weeklyStreak } from './progress';

const NOW = Date.parse('2026-11-25T12:00:00Z'); // Wednesday
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

describe('progress aggregations', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-11-25T12:00:00Z')).toBe('2026-11-23');
    expect(weekStart('2026-11-23T00:00:00Z')).toBe('2026-11-23');
    expect(weekStart('2026-11-22T23:59:00Z')).toBe('2026-11-16');
  });

  it('weekly frequency includes empty weeks, oldest first', () => {
    const f = weeklyFrequency([daysAgo(0), daysAgo(1), daysAgo(15)], NOW, 4);
    expect(f.map((w) => w.sessions)).toEqual([0, 1, 0, 2]);
    expect(f.at(-1)?.week).toBe('2026-11-23');
  });

  it('streak counts consecutive weeks and does not break on the current week', () => {
    expect(weeklyStreak([daysAgo(7), daysAgo(14), daysAgo(21)], NOW)).toBe(3);
    expect(weeklyStreak([daysAgo(0), daysAgo(7), daysAgo(28)], NOW)).toBe(2);
    expect(weeklyStreak([], NOW)).toBe(0);
  });

  it('volume per group: primary 1, secondary 0.5, last 7 days, no warm-ups', () => {
    const set = (d: number, p: string[], s: string[] = [], type: 'normal' | 'warmup' = 'normal') => ({
      completedAt: daysAgo(d), primaryMuscles: p, secondaryMuscles: s, weightKg: 20, reps: 10, seconds: null, rir: null, type,
    });
    const v = volumeByGroup([set(1, ['chest'], ['triceps']), set(2, ['chest']), set(1, ['biceps'], [], 'warmup'), set(10, ['chest'])], NOW);
    expect(v.find((g) => g.group === 'Pecho')?.sets).toBe(2);
    expect(v.find((g) => g.group === 'Brazos')?.sets).toBe(0.5);
  });

  it('exercise series per session, oldest first', () => {
    const s = (w: number, r: number) => ({ weightKg: w, reps: r, seconds: null, rir: null, type: 'normal' as const });
    const series = exerciseSeries([
      { date: '2026-11-20', sets: [s(60, 10), s(60, 8)] },
      { date: '2026-11-10', sets: [s(55, 10)] },
    ]);
    expect(series.map((p) => p.date)).toEqual(['2026-11-10', '2026-11-20']);
    expect(series[1]).toMatchObject({ topWeight: 60, volume: 1080, reps: 18 });
    expect(series[1]?.est1rm).toBe(80);
  });
});
