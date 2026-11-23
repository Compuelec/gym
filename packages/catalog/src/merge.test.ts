import { describe, expect, it } from 'vitest';
import { CatalogExerciseSchema } from '@gym/shared';
import { cleanSteps, mergeCatalog } from './merge';
import { inferMeasure, mapEquipment, type FedbExercise } from './sources/fedb';
import { spanishNamesByEnglish } from './sources/wger';

const base: FedbExercise = {
  id: 'Pushups',
  name: 'Pushups',
  force: 'push',
  level: 'beginner',
  mechanic: 'compound',
  equipment: 'body only',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['shoulders', 'triceps', 'chest'],
  instructions: ['Lie on the floor.', '', '  Push up.  '],
  category: 'strength',
  images: ['Pushups/0.jpg', 'Pushups/1.jpg'],
};

const wger = spanishNamesByEnglish([
  { id: 1, translations: [{ language: 2, name: 'Push-ups' }, { language: 4, name: 'Flexiones' }], license: { short_name: 'CC-BY-SA 4' }, license_author: 'Ana' },
]);

function merge(overrides: Partial<Parameters<typeof mergeCatalog>[0]> = {}) {
  return mergeCatalog({ fedb: [base], wgerNames: wger, translations: {}, version: 7, fedbRepoUrl: 'https://x', ...overrides })[0]!;
}

describe('mergeCatalog', () => {
  it('maps fields to the shared schema (valid catalog entry)', () => {
    const ex = merge();
    expect(CatalogExerciseSchema.safeParse(ex).success).toBe(true);
    expect(ex.id).toBe('fedb:Pushups');
    expect(ex.equipment).toEqual([]);
    expect(ex.measure).toBe('reps');
    expect(ex.media.map((m) => m.url)).toEqual(['/media/exercises/Pushups/0.webp', '/media/exercises/Pushups/1.webp']);
    expect(ex.media.every((m) => m.license === 'Unlicense')).toBe(true);
  });

  it('drops secondary muscles already listed as primary and cleans empty steps', () => {
    const ex = merge();
    expect(ex.secondaryMuscles).toEqual(['shoulders', 'triceps']);
    expect(ex.instructionsEs).toEqual(['Lie on the floor.', 'Push up.']);
  });

  it('prefers our translation, then a wger Spanish name (attributed), then English marked untranslated', () => {
    const translated = merge({ translations: { Pushups: { nameEs: 'Flexiones de brazos', instructionsEs: ['Túmbate.', 'Empuja.'], reviewed: true, source: 'human' } } });
    expect(translated).toMatchObject({ nameEs: 'Flexiones de brazos', translated: true, license: 'Unlicense' });

    const fromWger = merge({ fedb: [{ ...base, name: 'Push-Ups' }] });
    expect(fromWger).toMatchObject({ nameEs: 'Flexiones', translated: false });
    expect(fromWger.license).toContain('wger');
    expect(fromWger.authors).toContain('Ana');

    const english = merge({ wgerNames: new Map() });
    expect(english).toMatchObject({ nameEs: 'Pushups', translated: false });
  });

  it('applies reviewed equipment corrections (pull-ups need a bar, not «body only»)', () => {
    const pullups = merge({ fedb: [{ ...base, id: 'Pullups', name: 'Pullups', equipment: 'body only' }] });
    expect(pullups.equipment).toEqual(['pull_up_bar']);
    expect(pullups.measure).toBe('reps');
  });

  it('rejects unknown upstream values instead of guessing', () => {
    expect(() => mapEquipment('jetpack')).toThrow();
  });

  it('infers how sets are measured', () => {
    expect(inferMeasure({ ...base, category: 'stretching' }, [])).toBe('time');
    expect(inferMeasure({ ...base, force: 'static' }, [])).toBe('time');
    expect(inferMeasure({ ...base, equipment: 'barbell' }, ['barbell'])).toBe('weight_reps');
  });

  it('cleanSteps keeps at most 20 non-empty steps', () => {
    expect(cleanSteps(Array.from({ length: 25 }, (_, i) => `p${i}`))).toHaveLength(20);
  });
});
