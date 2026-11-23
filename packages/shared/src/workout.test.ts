import { describe, expect, it } from 'vitest';
import { RoutineItemSchema, SetEntrySchema, displayToKg, groupSupersets, kgToDisplay, setProblem } from './workout';

describe('sets', () => {
  it('requires the values each measure needs, with Spanish messages', () => {
    const empty = { weightKg: null, reps: null, seconds: null, meters: null };
    expect(setProblem({ ...empty, reps: 10, weightKg: 20 }, 'weight_reps')).toBeNull();
    expect(setProblem({ ...empty, reps: 10 }, 'weight_reps')).toBe('Indica el peso.');
    expect(setProblem({ ...empty, weightKg: 0, reps: 12 }, 'weight_reps')).toBeNull(); // empty bar / assisted
    expect(setProblem({ ...empty, reps: 15 }, 'reps')).toBeNull();
    expect(setProblem({ ...empty, seconds: 0 }, 'time')).toBe('Indica el tiempo.');
    expect(setProblem({ ...empty, meters: 400 }, 'distance')).toBeNull();
  });

  it('validates ranges and types', () => {
    const base = {
      sessionExerciseId: '0190f0c4-4b9e-7c3a-8d2e-5f6a7b8c9d0e',
      position: 0,
      type: 'normal',
      weightKg: 20,
      reps: 10,
      seconds: null,
      meters: null,
      rir: 2,
      rpe: null,
      completedAt: '2026-11-23T10:00:00.000Z',
      suggested: null,
    };
    expect(SetEntrySchema.safeParse(base).success).toBe(true);
    expect(SetEntrySchema.safeParse({ ...base, type: 'super' }).success).toBe(false);
    expect(SetEntrySchema.safeParse({ ...base, weightKg: -5 }).success).toBe(false);
  });
});

describe('units', () => {
  it('stores kg and shows lb rounded, round trip within a plate step', () => {
    expect(kgToDisplay(100, 'lb')).toBe(220.5);
    expect(kgToDisplay(22.5, 'kg')).toBe(22.5);
    expect(displayToKg(45, 'lb')).toBeCloseTo(20.412, 3);
    expect(kgToDisplay(displayToKg(135, 'lb'), 'lb')).toBe(135);
  });
});

describe('routine items', () => {
  it('rejects a rep range that goes backwards', () => {
    const item = { position: 0, exerciseId: 'fedb:X', supersetGroup: null, targetSets: 3, repMin: 12, repMax: 8, targetSeconds: null, targetRir: null, restSeconds: 90, notes: null };
    expect(RoutineItemSchema.safeParse(item).success).toBe(false);
    expect(RoutineItemSchema.safeParse({ ...item, repMin: 8, repMax: 12 }).success).toBe(true);
  });

  it('groups consecutive items of the same superset', () => {
    const items = [
      { position: 2, supersetGroup: 'A', id: 'c' },
      { position: 0, supersetGroup: null, id: 'a' },
      { position: 1, supersetGroup: 'A', id: 'b' },
      { position: 3, supersetGroup: null, id: 'd' },
    ];
    expect(groupSupersets(items).map((g) => g.map((i) => i.id))).toEqual([['a'], ['b', 'c'], ['d']]);
  });
});
