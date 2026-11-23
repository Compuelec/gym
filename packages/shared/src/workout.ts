import { z } from 'zod';
import { IsoDateSchema, UuidSchema } from './common';
import type { MEASURES } from './exercise';

const ExerciseRef = z.string().min(1).max(80); // catalog id ("fedb:…") or own exercise uuid
const Text = (max: number) => z.string().trim().max(max);

export const ProgramSchema = z.object({
  name: Text(80).min(1),
  weeks: z.number().int().min(1).max(16),
  source: z.enum(['user', 'coach']),
  coachRequestId: z.string().nullable().optional(),
  startedAt: IsoDateSchema.nullable().optional(),
  archivedAt: IsoDateSchema.nullable().optional(),
  summaryEs: Text(600).nullable().optional(),
});
export type Program = z.infer<typeof ProgramSchema>;

export const RoutineItemSchema = z
  .object({
    position: z.number().int().min(0).max(100),
    exerciseId: ExerciseRef,
    supersetGroup: z.string().max(8).nullable(),
    targetSets: z.number().int().min(1).max(10),
    repMin: z.number().int().min(1).max(100).nullable(),
    repMax: z.number().int().min(1).max(100).nullable(),
    targetSeconds: z.number().int().min(5).max(3600).nullable(),
    targetRir: z.number().int().min(0).max(5).nullable(),
    restSeconds: z.number().int().min(0).max(600),
    notes: Text(160).nullable(),
  })
  .refine((i) => i.repMin === null || i.repMax === null || i.repMin <= i.repMax, { message: 'repMin > repMax' });
export type RoutineItem = z.infer<typeof RoutineItemSchema>;

export const RoutineSchema = z.object({
  name: Text(60).min(1),
  programId: UuidSchema.nullable(),
  weekIndex: z.number().int().min(1).max(16).nullable(),
  dayIndex: z.number().int().min(1).max(7).nullable(),
  locationId: UuidSchema.nullable(),
  notes: Text(500).nullable(),
  items: z.array(RoutineItemSchema).max(30),
});
export type Routine = z.infer<typeof RoutineSchema>;

export const SESSION_STATUSES = ['in_progress', 'completed', 'discarded'] as const;

export const WorkoutSessionSchema = z.object({
  routineId: UuidSchema.nullable(),
  locationId: UuidSchema.nullable(),
  name: Text(60).min(1),
  startedAt: IsoDateSchema,
  endedAt: IsoDateSchema.nullable(),
  status: z.enum(SESSION_STATUSES),
  notes: Text(1000).nullable(),
  perceivedEffort: z.number().int().min(1).max(10).nullable(),
});
export type WorkoutSession = z.infer<typeof WorkoutSessionSchema>;

export const SessionExerciseSchema = z.object({
  sessionId: UuidSchema,
  position: z.number().int().min(0).max(100),
  exerciseId: ExerciseRef,
  replacedFromExerciseId: ExerciseRef.nullable(),
  supersetGroup: z.string().max(8).nullable(),
  restSeconds: z.number().int().min(0).max(600),
  notes: Text(500).nullable(),
  // Targets copied from the routine or today's plan (null for free sessions).
  targetSets: z.number().int().min(1).max(10).nullable().optional(),
  repMin: z.number().int().min(1).max(100).nullable().optional(),
  repMax: z.number().int().min(1).max(100).nullable().optional(),
  targetSeconds: z.number().int().min(5).max(3600).nullable().optional(),
});
export type SessionExercise = z.infer<typeof SessionExerciseSchema>;

export const SET_TYPES = ['warmup', 'normal', 'failure', 'drop'] as const;

export const SuggestionSchema = z.object({
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  seconds: z.number().int().min(0).max(36000).nullable().optional(),
  reason: Text(300),
});

export const SetEntrySchema = z.object({
  sessionExerciseId: UuidSchema,
  position: z.number().int().min(0).max(50),
  type: z.enum(SET_TYPES),
  weightKg: z.number().min(0).max(1000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  seconds: z.number().int().min(0).max(36000).nullable(),
  meters: z.number().min(0).max(1_000_000).nullable(),
  rir: z.number().int().min(0).max(10).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
  completedAt: IsoDateSchema,
  suggested: SuggestionSchema.nullable(),
});
export type SetEntry = z.infer<typeof SetEntrySchema>;

type Measure = (typeof MEASURES)[number];

/** Checks that a set has the values its exercise is measured by; returns a Spanish error or null. */
export function setProblem(set: Pick<SetEntry, 'weightKg' | 'reps' | 'seconds' | 'meters'>, measure: Measure): string | null {
  switch (measure) {
    case 'weight_reps':
      if (set.reps === null || set.reps < 1) return 'Indica las repeticiones.';
      if (set.weightKg === null) return 'Indica el peso.';
      return null;
    case 'reps':
      return set.reps === null || set.reps < 1 ? 'Indica las repeticiones.' : null;
    case 'time':
      return set.seconds === null || set.seconds < 1 ? 'Indica el tiempo.' : null;
    case 'distance':
      return set.meters === null || set.meters <= 0 ? 'Indica la distancia.' : null;
  }
}

export const KG_PER_LB = 0.45359237;

/** Weights are stored in kg; shown in the user's unit, rounded to a usable plate step. */
export function kgToDisplay(kg: number, units: 'kg' | 'lb'): number {
  return units === 'kg' ? Math.round(kg * 100) / 100 : Math.round((kg / KG_PER_LB) * 10) / 10;
}

export function displayToKg(value: number, units: 'kg' | 'lb'): number {
  return units === 'kg' ? value : Math.round(value * KG_PER_LB * 1000) / 1000;
}

/** Items that share a superset group are done back to back; returns groups in order. */
export function groupSupersets<T extends { supersetGroup: string | null; position: number }>(items: T[]): T[][] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const groups: T[][] = [];
  for (const item of sorted) {
    const last = groups.at(-1);
    if (item.supersetGroup && last?.[0]?.supersetGroup === item.supersetGroup) last.push(item);
    else groups.push([item]);
  }
  return groups;
}
