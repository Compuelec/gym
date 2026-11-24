import { describe, expect, it } from 'vitest';
import { filterExercises, fitsEquipment, normalizeText, searchExercises, stemWord, type FilterableExercise } from './catalog-filter';

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

describe('text search', () => {
  const catalog = [
    ex({ nameEs: 'Press de banca con barra, agarre medio', primaryMuscles: ['chest'], equipment: ['barbell', 'bench'] }),
    ex({ nameEs: 'Pullover declinado con barra y agarre ancho', primaryMuscles: ['chest'], equipment: ['barbell', 'bench'] }),
    ex({ nameEs: 'Curl con barra boca abajo en banco alto', primaryMuscles: ['biceps'], equipment: ['barbell', 'bench'] }),
    ex({ nameEs: 'Curl martillo', primaryMuscles: ['biceps'], equipment: ['dumbbell'] }),
    ex({ nameEs: 'Aperturas con mancuernas', primaryMuscles: ['chest'], equipment: ['dumbbell', 'bench'] }),
    ex({ nameEs: 'Sentadilla goblet', primaryMuscles: ['quadriceps'], equipment: ['dumbbell'] }),
  ];
  const names = (r: { results: FilterableExercise[] }) => r.results.map((e) => e.nameEs);

  it('stems plurals and word endings', () => {
    expect(stemWord('pectorales')).toBe('pectoral');
    expect(stemWord('curls')).toBe('curl');
    expect(stemWord('banca')).toBe(stemWord('banco'));
    expect(stemWord('sentadillas')).toBe(stemWord('sentadilla'));
  });

  it('ignores filler words and matches muscles and equipment, not only the name', () => {
    // «banca» finds «banco», «pecho» finds chest exercises whose name does not say it.
    const r = searchExercises(catalog, { text: 'press en banca para pecho' });
    expect(r.approximate).toBe(false);
    expect(names(r)).toEqual(['Press de banca con barra, agarre medio']);
    expect(names(searchExercises(catalog, { text: 'pectorales con mancuernas' }))).toEqual(['Aperturas con mancuernas']);
  });

  it('with no exact match shows the closest ones first instead of nothing (seen in production)', () => {
    const r = searchExercises(catalog, { text: 'curls con barra en banca para pectorales' });
    expect(r.approximate).toBe(true);
    // 3 of 4 words: bar + bench + chest, or curl + bar + bench.
    expect(names(r).slice(0, 3).sort()).toEqual([
      'Curl con barra boca abajo en banco alto',
      'Press de banca con barra, agarre medio',
      'Pullover declinado con barra y agarre ancho',
    ]);
    expect(names(r)).not.toContain('Sentadilla goblet');
  });

  it('the equipment filter still applies to approximate results', () => {
    const r = searchExercises(catalog, { text: 'curls con barra en banca para pectorales', availableEquipment: ['dumbbell', 'bench'] });
    expect(names(r)).not.toContain('Press de banca con barra, agarre medio');
    expect(names(r)).toContain('Aperturas con mancuernas');
  });

  it('only filler words means no text filter', () => {
    expect(searchExercises(catalog, { text: 'con para de' }).results).toHaveLength(catalog.length);
  });
});
