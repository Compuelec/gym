import { describe, expect, it } from 'vitest';
import { bmiOf, goalPlan } from './goals';

const NOW = Date.parse('2026-11-23T12:00:00Z');

describe('goal plan', () => {
  it('computes BMI with a Spanish label', () => {
    expect(bmiOf(80, 175)).toBe(26.1);
    expect(goalPlan({ weightKg: 80, heightCm: 175, now: NOW })).toMatchObject({ bmi: 26.1, bmiLabel: 'sobrepeso', pace: 'none' });
  });

  it('a healthy loss pace (0.5 kg/week for 80 kg)', () => {
    const p = goalPlan({ weightKg: 80, targetWeightKg: 74, targetDate: '2027-02-15', now: NOW });
    expect(p.diffKg).toBe(-6);
    expect(p.weeklyKg).toBeCloseTo(-0.5, 1);
    expect(p.pace).toBe('ok');
    expect(p.message).toMatch(/^Para bajar 6 kg en 12 semanas necesitas bajar unos 0,5 kg por semana\. Es un ritmo saludable\.$/);
  });

  it('warns when losing is too fast, and when the date is past', () => {
    expect(goalPlan({ weightKg: 80, targetWeightKg: 70, targetDate: '2026-12-21', now: NOW }).pace).toBe('too_fast');
    expect(goalPlan({ weightKg: 80, targetWeightKg: 75, targetDate: '2026-11-01', now: NOW }).pace).toBe('past_date');
  });

  it('gaining weight: 0.25 kg/week is fine, 1 kg/week is too fast', () => {
    expect(goalPlan({ weightKg: 70, targetWeightKg: 73, targetDate: '2027-11-23', now: NOW }).pace).toBe('ok');
    expect(goalPlan({ weightKg: 70, targetWeightKg: 74, targetDate: '2026-12-21', now: NOW }).pace).toBe('too_fast');
  });

  it('already there, or no date yet', () => {
    expect(goalPlan({ weightKg: 70, targetWeightKg: 70.2, targetDate: '2027-01-01', now: NOW }).message).toMatch(/Ya estás en tu peso objetivo/);
    expect(goalPlan({ weightKg: 70, targetWeightKg: 65, now: NOW }).message).toBe('Te faltan 5 kg. Pon una fecha meta para calcular el ritmo semanal.');
  });
});
