import { z } from 'zod';
import { IsoDateSchema } from './common';
import { EQUIPMENT_SLUGS } from './vocabulary';

export const GOALS = ['strength', 'hypertrophy', 'endurance', 'health', 'fat_loss'] as const;
export const LEVELS = ['beginner', 'intermediate', 'expert'] as const;

export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  strength: 'Ganar fuerza',
  hypertrophy: 'Ganar músculo',
  endurance: 'Resistencia',
  health: 'Salud general',
  fat_loss: 'Perder grasa',
};

export const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  expert: 'Avanzado',
};

/** Profile data synced for the user (its id is the user id). */
export const ProfileSchema = z.object({
  goal: z.enum(GOALS),
  level: z.enum(LEVELS),
  daysPerWeek: z.number().int().min(1).max(7),
  sessionMinutes: z.number().int().min(10).max(180),
  units: z.enum(['kg', 'lb']),
  bodyweightKg: z.number().min(20).max(400).nullable().optional(),
  birthYear: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  sex: z.enum(['female', 'male', 'other']).nullable().optional(),
  medicalAckAt: IsoDateSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const LocationSchema = z.object({
  name: z.string().trim().min(1).max(40),
  equipment: z.array(z.enum(EQUIPMENT_SLUGS)).max(EQUIPMENT_SLUGS.length),
  isDefault: z.boolean(),
});
export type Location = z.infer<typeof LocationSchema>;
