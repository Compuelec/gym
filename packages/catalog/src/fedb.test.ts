import { describe, expect, it } from 'vitest';
import { EQUIPMENT_SLUGS } from '@gym/shared';
import { EQUIPMENT_OVERRIDES, exerciseEquipment } from './sources/fedb';

describe('exercise equipment', () => {
  it('splits the vague upstream «other» into the real gear', () => {
    expect(exerciseEquipment({ id: 'Sled_Row', name: 'Sled Row', equipment: 'other' })).toEqual(['sled']);
    expect(exerciseEquipment({ id: 'Weighted_Pull_Ups', name: 'Weighted Pull Ups', equipment: 'other' })).toEqual(['pull_up_bar', 'plate']);
    expect(exerciseEquipment({ id: 'Parallel_Bar_Dip', name: 'Parallel Bar Dip', equipment: 'other' })).toEqual(['dip_bars']);
    expect(exerciseEquipment({ id: 'Quad_Stretch', name: 'Quad Stretch', equipment: 'other' })).toEqual([]);
  });

  it('free-weight exercises on a bench also need the bench', () => {
    expect(exerciseEquipment({ id: 'Dumbbell_Bench_Press', name: 'Dumbbell Bench Press', equipment: 'dumbbell' })).toEqual(['dumbbell', 'bench']);
    expect(exerciseEquipment({ id: 'Incline_Dumbbell_Curl', name: 'Incline Dumbbell Curl', equipment: 'dumbbell' })).toEqual(['dumbbell', 'bench']);
    expect(exerciseEquipment({ id: 'Hammer_Curls', name: 'Hammer Curls', equipment: 'dumbbell' })).toEqual(['dumbbell']);
  });

  it('every override uses known equipment', () => {
    for (const list of Object.values(EQUIPMENT_OVERRIDES)) for (const e of list) expect(EQUIPMENT_SLUGS).toContain(e);
  });
});
