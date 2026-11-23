import { describe, expect, it } from 'vitest';
import type { CoachProgram } from '@gym/shared';
import { mentionsHealth } from '@gym/shared';
import { validateProgram, validateReview } from './coach-validate';

const HOME = '0190f0c4-4b9e-7c3a-8d2e-5f6a7b8c9d0e';
const ctx = {
  catalog: new Map([
    ['fedb:Goblet_Squat', { id: 'fedb:Goblet_Squat', equipment: ['dumbbell'] }],
    ['fedb:Pushups', { id: 'fedb:Pushups', equipment: [] }],
    ['fedb:Bench_Press', { id: 'fedb:Bench_Press', equipment: ['barbell', 'bench'] }],
    ['fedb:Plank', { id: 'fedb:Plank', equipment: [] }],
  ]),
  locations: new Map([[HOME, ['dumbbell', 'band']]]),
  daysPerWeek: 3,
  sessionMinutes: 45,
};
const item = (exerciseId: string, o: Partial<CoachProgram['days'][number]['items'][number]> = {}) => ({
  exerciseId, sets: 3, repMin: 8, repMax: 12, seconds: null, rir: 2, restSeconds: 90, supersetGroup: null, noteEs: null, ...o,
});
const program = (days: CoachProgram['days']): CoachProgram => ({ name: 'P', summaryEs: 'S', weeks: 4, progressionNoteEs: 'N', days, safetyNoteEs: null });

describe('validateProgram', () => {
  it('accepts a program that uses catalog exercises with the location equipment', () => {
    const r = validateProgram(program([{ dayIndex: 1, title: 'A', locationId: HOME, items: [item('fedb:Goblet_Squat'), item('fedb:Pushups')] }]), ctx);
    expect(r.errors).toEqual([]);
    expect(r.retry).toBe(false);
  });

  it('drops invented exercises and ones needing missing equipment, explaining why in Spanish', () => {
    const items = [item('fedb:Goblet_Squat'), item('fedb:Pushups'), item('fedb:Inventado'), item('fedb:Bench_Press'), item('fedb:Plank', { repMin: null, repMax: null, seconds: 30 })];
    const r = validateProgram(program([{ dayIndex: 1, title: 'A', locationId: HOME, items }]), ctx);
    expect(r.program.days[0]?.items.map((i) => i.exerciseId)).toEqual(['fedb:Goblet_Squat', 'fedb:Pushups', 'fedb:Plank']);
    expect(r.errors.join(' ')).toMatch(/no existe en el catálogo/);
    expect(r.errors.join(' ')).toMatch(/necesita equipo/);
    expect(r.retry).toBe(true); // 2 of 5 invalid > 20 %
  });

  it('asks for a retry when a day is left empty or there are more days than the profile', () => {
    expect(validateProgram(program([{ dayIndex: 1, title: 'A', locationId: HOME, items: [item('fedb:Nope')] }]), ctx).retry).toBe(true);
    const four = [1, 2, 3, 4].map((d) => ({ dayIndex: d, title: `D${d}`, locationId: HOME, items: [item('fedb:Pushups')] }));
    const r = validateProgram(program(four), ctx);
    expect(r.retry).toBe(true);
    expect(r.program.days).toHaveLength(3);
  });

  it('flags days far longer than the available time (±15 %)', () => {
    const long = Array.from({ length: 8 }, () => item('fedb:Pushups', { sets: 5, restSeconds: 120 }));
    expect(validateProgram(program([{ dayIndex: 1, title: 'A', locationId: HOME, items: long }]), ctx).errors.join(' ')).toMatch(/dura más de 45 minutos/);
  });

  it('replaces an unknown location with one of the user', () => {
    const r = validateProgram(program([{ dayIndex: 1, title: 'A', locationId: 'otro', items: [item('fedb:Pushups')] }]), ctx);
    expect(r.program.days[0]?.locationId).toBe(HOME);
  });
});

describe('validateReview', () => {
  it('keeps only adjustments about the user routines and existing exercises', () => {
    const r = validateReview(
      { highlightsEs: ['Bien'], concernsEs: [], adjustments: [
        { routineId: 'r1', exerciseId: 'fedb:Pushups', changeEs: 'Sube a 4 series' },
        { routineId: 'ajena', exerciseId: 'fedb:Pushups', changeEs: 'x' },
        { routineId: 'r1', exerciseId: 'fedb:Inventado', changeEs: 'x' },
      ] },
      new Set(['r1']),
      ctx.catalog,
    );
    expect(r.adjustments).toHaveLength(1);
  });
});

describe('health topics', () => {
  it('detects messages that need a professional', () => {
    expect(mentionsHealth('Tengo dolor de rodilla')).toBe(true);
    expect(mentionsHealth('Estoy EMBARAZADA de 3 meses')).toBe(true);
    expect(mentionsHealth('quiero ganar fuerza en casa')).toBe(false);
  });
});
