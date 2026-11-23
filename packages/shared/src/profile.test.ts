import { describe, expect, it } from 'vitest';
import { LocationSchema, ProfileSchema } from './profile';

const valid = {
  goal: 'strength',
  level: 'beginner',
  daysPerWeek: 3,
  sessionMinutes: 45,
  units: 'kg',
  medicalAckAt: '2026-11-23T10:00:00.000Z',
};

describe('ProfileSchema', () => {
  it('accepts a complete profile', () => {
    expect(ProfileSchema.safeParse(valid).success).toBe(true);
  });
  it.each([
    ['daysPerWeek', 0],
    ['daysPerWeek', 8],
    ['sessionMinutes', 5],
    ['units', 'stone'],
    ['goal', 'fly'],
  ])('rejects %s = %s', (field, value) => {
    expect(ProfileSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
  it('requires accepting the medical disclaimer', () => {
    const { medicalAckAt: _, ...rest } = valid;
    expect(ProfileSchema.safeParse(rest).success).toBe(false);
  });
});

describe('LocationSchema', () => {
  it('accepts known equipment only', () => {
    expect(LocationSchema.safeParse({ name: 'Casa', equipment: ['dumbbell', 'band'], isDefault: true }).success).toBe(true);
    expect(LocationSchema.safeParse({ name: 'Casa', equipment: ['laser'], isDefault: true }).success).toBe(false);
  });
  it('trims and requires a name of at most 40 characters', () => {
    expect(LocationSchema.safeParse({ name: '   ', equipment: [], isDefault: false }).success).toBe(false);
    expect(LocationSchema.safeParse({ name: 'x'.repeat(41), equipment: [], isDefault: false }).success).toBe(false);
  });
});
