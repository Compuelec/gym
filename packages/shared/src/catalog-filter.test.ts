import { describe, expect, it } from 'vitest';
import { filterExercises, fitsEquipment, normalizeText, type FilterableExercise } from './catalog-filter';

const ex = (o: Partial<FilterableExercise> & { nameEs: string }): FilterableExercise => ({
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  equipment: [],
  level: 'beginner',
  category: 'strength',
  ...o,
});

const list = [
  ex({ nameEs: 'Flexiones', nameEn: 'Pushups', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'] }),
  ex({ nameEs: 'Press de banca con barra', primaryMuscles: ['chest'], equipment: ['barbell', 'bench'] }),
  ex({ nameEs: 'Press con mancuernas', primaryMuscles: ['chest'], equipment: ['dumbbell'] }),
  ex({ nameEs: 'Sentadilla búlgara', primaryMuscles: ['quadriceps'], equipment: ['dumbbell'], level: 'intermediate' }),
  ex({ nameEs: 'Extensión de tríceps', primaryMuscles: ['triceps'], equipment: ['cable'] }),
  ex({ nameEs: 'Ejercicio retirado', retiredAt: '2026-01-01T00:00:00Z' }),
];

describe('catalog filters', () => {
  it('search ignores accents and case, in Spanish and English names', () => {
    expect(filterExercises(list, { text: 'BULGARA' }).map((e) => e.nameEs)).toEqual(['Sentadilla búlgara']);
    expect(filterExercises(list, { text: 'pushups' })).toHaveLength(1);
    expect(normalizeText('Tríceps')).toBe('triceps');
  });

  it('location filter: only exercises doable with the equipment there (bodyweight always)', () => {
    const home = ['dumbbell', 'band'];
    const names = filterExercises(list, { muscle: 'chest', availableEquipment: home }).map((e) => e.nameEs);
    expect(names).toEqual(['Flexiones', 'Press con mancuernas']);
  });

  it('requires every piece of equipment, not just one', () => {
    expect(fitsEquipment(['barbell', 'bench'], ['barbell'])).toBe(false);
    expect(fitsEquipment(['barbell', 'bench'], ['barbell', 'bench', 'dumbbell'])).toBe(true);
    expect(fitsEquipment([], [])).toBe(true);
  });

  it('muscle filter uses primary muscles unless secondary are included', () => {
    expect(filterExercises(list, { muscle: 'triceps' }).map((e) => e.nameEs)).toEqual(['Extensión de tríceps']);
    expect(filterExercises(list, { muscle: 'triceps', includeSecondary: true })).toHaveLength(2);
  });

  it('filters by level, equipment and category, sorted in Spanish order, never retired', () => {
    expect(filterExercises(list, { level: 'intermediate' })).toHaveLength(1);
    expect(filterExercises(list, { equipment: 'dumbbell' })).toHaveLength(2);
    expect(filterExercises(list, {}).map((e) => e.nameEs)).not.toContain('Ejercicio retirado');
    const all = filterExercises(list, {}).map((e) => e.nameEs);
    expect(all).toEqual([...all].sort((a, b) => a.localeCompare(b, 'es')));
  });
});
