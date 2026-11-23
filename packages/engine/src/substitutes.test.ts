import { describe, expect, it } from 'vitest';
import { findSubstitutes, type SubstituteCandidate } from './substitutes';

const ex = (id: string, o: Partial<SubstituteCandidate>): SubstituteCandidate => ({
  id,
  nameEs: id,
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  equipment: [],
  mechanic: 'compound',
  force: 'push',
  measure: 'weight_reps',
  ...o,
});

const bench = ex('bench', { equipment: ['barbell', 'bench'], secondaryMuscles: ['triceps', 'shoulders'] });
const catalog = [
  bench,
  ex('db-press', { equipment: ['dumbbell'], secondaryMuscles: ['triceps', 'shoulders'] }),
  ex('pushup', { equipment: [], secondaryMuscles: ['triceps'], measure: 'reps' }),
  ex('fly', { equipment: ['dumbbell'], mechanic: 'isolation' }),
  ex('cable-fly', { equipment: ['cable'], mechanic: 'isolation' }),
  ex('squat', { primaryMuscles: ['quadriceps'], equipment: ['dumbbell'] }),
  ex('old', { equipment: ['dumbbell'], retiredAt: '2026-01-01T00:00:00Z' }),
];

describe('findSubstitutes', () => {
  it('suggests same-muscle exercises doable with the location equipment, best first', () => {
    const subs = findSubstitutes(bench, catalog, ['dumbbell', 'band'], 'Casa');
    expect(subs.map((s) => s.exerciseId)).toEqual(['db-press', 'pushup', 'fly']);
  });

  it('never suggests the same exercise, retired ones, other muscles or missing equipment', () => {
    const ids = findSubstitutes(bench, catalog, ['dumbbell'], 'Casa').map((s) => s.exerciseId);
    expect(ids).not.toContain('bench');
    expect(ids).not.toContain('old');
    expect(ids).not.toContain('squat');
    expect(ids).not.toContain('cable-fly');
  });

  it('explains each suggestion in Spanish', () => {
    const [first] = findSubstitutes(bench, catalog, ['dumbbell'], 'Casa');
    expect(first?.reason).toBe('Trabaja pecho con mancuernas, disponible en Casa.');
    const pushup = findSubstitutes(bench, catalog, [], 'Parque')[0];
    expect(pushup?.reason).toBe('Trabaja pecho con tu propio peso, disponible en Parque.');
  });

  it('respects the limit', () => {
    expect(findSubstitutes(bench, catalog, ['dumbbell', 'cable'], 'Gimnasio', 2)).toHaveLength(2);
  });
});
