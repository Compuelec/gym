import { z } from 'zod';
import { IsoDateSchema } from './common';
import { EQUIPMENT_SLUGS } from './vocabulary';

export const GOALS = ['strength', 'hypertrophy', 'endurance', 'health', 'fat_loss'] as const;
export const LEVELS = ['beginner', 'intermediate', 'expert'] as const;
export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'high'] as const;

export const ACTIVITY_LABELS: Record<(typeof ACTIVITY_LEVELS)[number], string> = {
  sedentary: 'Sedentaria (trabajo sentado)',
  light: 'Ligera (camino algo cada día)',
  moderate: 'Moderada (de pie o en movimiento gran parte del día)',
  high: 'Alta (trabajo físico)',
};

/** IANA time zone known to this runtime (e.g. America/Santiago). */
const isTimeZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('es', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

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
  // Goal (User Story «coach con objetivos»): health data, owner-only, never logged.
  heightCm: z.number().int().min(100).max(250).nullable().optional(),
  targetWeightKg: z.number().min(25).max(400).nullable().optional(),
  targetDate: z.iso.date().nullable().optional(),
  activityLevel: z.enum(ACTIVITY_LEVELS).nullable().optional(),
  injuries: z.string().trim().max(300).nullable().optional(),
  // Notifications: training reminder on these weekdays (0 = Sunday … 6 = Saturday) at a local
  // time, in the person's time zone; weekly summary on Sunday evening.
  reminderDays: z.array(z.number().int().min(0).max(6)).max(7).nullable().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  timeZone: z.string().max(64).refine(isTimeZone).nullable().optional(),
  weeklySummary: z.boolean().nullable().optional(),
  medicalAckAt: IsoDateSchema,
});
export type Profile = z.infer<typeof ProfileSchema>;

export const LocationSchema = z.object({
  name: z.string().trim().min(1).max(40),
  equipment: z.array(z.enum(EQUIPMENT_SLUGS)).max(EQUIPMENT_SLUGS.length),
  isDefault: z.boolean(),
});
export type Location = z.infer<typeof LocationSchema>;
