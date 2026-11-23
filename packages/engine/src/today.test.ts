import { describe, expect, it } from 'vitest';
import { muscleRecovery } from './recovery';
import { generateToday, type TodayCandidate } from './today';

const NOW = Date.parse('2026-11-23T12:00:00Z');
const c = (id: string, primary: string[], equipment: string[], o: Partial<TodayCandidate> = {}): TodayCandidate => ({
  id,
  nameEs: id,
  primaryMuscles: primary,
  equipment,
  level: 'beginner',
  category: 'strength',
  mechanic: 'compound',
  measure: 'weight_reps',
  ...o,
});
const catalog = [
  c('goblet-squat', ['quadriceps'], ['dumbbell']),
  c('barbell-squat', ['quadriceps'], ['barbell']),
  c('db-press', ['chest'], ['dumbbell']),
  c('pushup', ['chest'], [], { measure: 'reps' }),
  c('db-row', ['middle_back'], ['dumbbell']),
  c('band-pulldown', ['lats'], ['band']),
  c('curl', ['biceps'], ['dumbbell'], { mechanic: 'isolation' }),
  c('lateral-raise', ['shoulders'], ['dumbbell'], { mechanic: 'isolation' }),
  c('expert-move', ['chest'], [], { level: 'expert' }),
  c('plank', ['abdominals'], [], { measure: 'time' }),
];

describe('generateToday', () => {
  const legDayYesterday = Array.from({ length: 12 }, () => ({
    completedAt: new Date(NOW - 20 * 3_600_000).toISOString(),
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    warmup: false,
  }));

  it('after a heavy leg day, 30 minutes at home: no legs, only home equipment, with reasons', () => {
    const r = generateToday({
      goal: 'hypertrophy',
      level: 'beginner',
      minutes: 30,
      equipment: ['dumbbell', 'band'],
      locationName: 'Casa',
      recovery: muscleRecovery(legDayYesterday, NOW),
      catalog,
    });
    const ids = r.items.map((i) => i.exerciseId);
    expect(ids).not.toContain('goblet-squat');
    expect(ids).not.toContain('barbell-squat');
    expect(r.avoided).toContain('Piernas');
    expect(r.reason).toMatch(/Evitamos piernas porque los trabajaste hace poco/);
    expect(r.items.every((i) => i.reason.length > 0)).toBe(true);
    // Neutral wording that agrees with singular and plural muscle names.
    for (const reason of r.items.map((i) => i.reason)) {
      expect(reason).toMatch(/^[A-ZÁÉÍÓÚ][\p{L} ]+: (sin trabajo reciente|recuperado; llevas|casi recuperado)/u);
    }
    expect(r.estimatedMinutes).toBeLessThanOrEqual(30);
  });

  it('respects level, skips timed holds, and puts compound exercises first', () => {
    const r = generateToday({ goal: 'health', level: 'beginner', minutes: 60, equipment: ['dumbbell', 'band'], locationName: 'Casa', recovery: muscleRecovery([], NOW), catalog });
    const ids = r.items.map((i) => i.exerciseId);
    expect(ids).not.toContain('expert-move');
    expect(ids).not.toContain('plank');
    const firstIsolation = ids.findIndex((id) => ['curl', 'lateral-raise'].includes(id));
    const lastCompound = Math.max(...ids.map((id, i) => (['db-press', 'db-row', 'band-pulldown', 'goblet-squat', 'pushup'].includes(id) ? i : -1)));
    if (firstIsolation >= 0) expect(lastCompound).toBeLessThan(firstIsolation);
  });

  it('fits the time budget (more minutes → more exercises) and uses the goal scheme', () => {
    const recovery = muscleRecovery([], NOW);
    const short = generateToday({ goal: 'strength', level: 'beginner', minutes: 20, equipment: ['dumbbell', 'band'], locationName: 'Casa', recovery, catalog });
    const long = generateToday({ goal: 'strength', level: 'beginner', minutes: 75, equipment: ['dumbbell', 'band'], locationName: 'Casa', recovery, catalog });
    expect(long.items.length).toBeGreaterThan(short.items.length);
    expect(short.items[0]).toMatchObject({ sets: 4, repMin: 4, repMax: 6, restSeconds: 150 });
  });

  it('strength first and cardio to finish, on the machine the place has', () => {
    const withCardio = [
      ...catalog,
      c('trail-walk', [], [], { category: 'cardio', measure: 'time', mechanic: null }),
      c('treadmill-walk', [], ['treadmill'], { category: 'cardio', measure: 'time', mechanic: null }),
      c('bike', [], ['stationary_bike'], { category: 'cardio', measure: 'time', mechanic: null }),
    ];
    const base = { goal: 'fat_loss' as const, level: 'beginner', minutes: 60, locationName: 'Casa', recovery: muscleRecovery([], NOW), catalog: withCardio };
    const home = generateToday({ ...base, equipment: ['dumbbell', 'treadmill'] });
    const last = home.items.at(-1)!;
    expect(last).toMatchObject({ exerciseId: 'treadmill-walk', sets: 1, seconds: 15 * 60, restSeconds: 0 });
    expect(home.items.slice(0, -1).every((i) => i.seconds === null)).toBe(true);
    expect(home.reason).toMatch(/Primero fuerza y al final 15 minutos de cardio/);
    expect(home.estimatedMinutes).toBeLessThanOrEqual(60);

    // No machine: walking or jogging outside.
    expect(generateToday({ ...base, equipment: ['dumbbell'] }).items.at(-1)?.exerciseId).toBe('trail-walk');
    // A short session keeps most of its time for strength.
    const short = generateToday({ ...base, minutes: 20, equipment: ['dumbbell', 'treadmill'] });
    expect(short.items.at(-1)?.seconds).toBe(6 * 60);
  });
});
