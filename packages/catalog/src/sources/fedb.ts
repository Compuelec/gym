import { z } from 'zod';

/** Raw free-exercise-db record (dist/exercises.json). */
export const FedbExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  force: z.enum(['pull', 'push', 'static']).nullable(),
  level: z.enum(['beginner', 'intermediate', 'expert']),
  mechanic: z.enum(['compound', 'isolation']).nullable(),
  equipment: z.string().nullable(),
  primaryMuscles: z.array(z.string()),
  secondaryMuscles: z.array(z.string()),
  instructions: z.array(z.string()),
  category: z.string(),
  images: z.array(z.string()),
});
export type FedbExercise = z.infer<typeof FedbExerciseSchema>;

export const FEDB_EQUIPMENT: Record<string, string[]> = {
  'body only': [],
  dumbbell: ['dumbbell'],
  barbell: ['barbell'],
  cable: ['cable'],
  machine: ['machine'],
  kettlebells: ['kettlebell'],
  bands: ['band'],
  'medicine ball': ['medicine_ball'],
  'exercise ball': ['exercise_ball'],
  'foam roll': ['foam_roll'],
  'e-z curl bar': ['ez_bar'],
  other: ['other'],
};

export const FEDB_MUSCLES: Record<string, string> = {
  abdominals: 'abdominals',
  abductors: 'abductors',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'lower_back',
  'middle back': 'middle_back',
  neck: 'neck',
  quadriceps: 'quadriceps',
  shoulders: 'shoulders',
  traps: 'traps',
  triceps: 'triceps',
};

export const FEDB_CATEGORY: Record<string, string> = {
  strength: 'strength',
  stretching: 'stretching',
  plyometrics: 'plyometrics',
  cardio: 'cardio',
  powerlifting: 'powerlifting',
  'olympic weightlifting': 'olympic_weightlifting',
  strongman: 'strongman',
};

/**
 * Corrections to upstream equipment, by free-exercise-db id: the source marks bar exercises as
 * "body only", which would offer pull-ups at home without a bar. Reviewed by hand.
 */
export const EQUIPMENT_OVERRIDES: Record<string, string[]> = {
  'Band_Assisted_Pull-Up': ['pull_up_bar', 'band'],
  Bench_Dips: ['bench'],
  'Chin-Up': ['pull_up_bar'],
  'Dips_-_Triceps_Version': ['other'], // parallel bars
  Hanging_Leg_Raise: ['pull_up_bar'],
  Hanging_Pike: ['pull_up_bar'],
  Kipping_Muscle_Up: ['pull_up_bar'],
  Muscle_Up: ['pull_up_bar'],
  'One_Arm_Chin-Up': ['pull_up_bar'],
  Pullups: ['pull_up_bar'],
  'Rocky_Pull-Ups_Pulldowns': ['pull_up_bar'],
  'Scapular_Pull-Up': ['pull_up_bar'],
  'V-Bar_Pullup': ['pull_up_bar'],
  'Wide-Grip_Rear_Pull-Up': ['pull_up_bar'],
};

export function exerciseEquipment(ex: { id: string; equipment: string | null }): string[] {
  return EQUIPMENT_OVERRIDES[ex.id] ?? mapEquipment(ex.equipment);
}

export function mapEquipment(raw: string | null): string[] {
  if (raw === null) return [];
  const mapped = FEDB_EQUIPMENT[raw];
  if (!mapped) throw new Error(`Unknown free-exercise-db equipment: ${raw}`);
  return mapped;
}

export function mapMuscles(raw: string[]): string[] {
  return [...new Set(raw.map((m) => {
    const mapped = FEDB_MUSCLES[m];
    if (!mapped) throw new Error(`Unknown free-exercise-db muscle: ${m}`);
    return mapped;
  }))];
}

/** How a set is measured: holds and cardio by time, bodyweight moves by reps, the rest weight×reps. */
export function inferMeasure(ex: FedbExercise, equipment: string[]): 'weight_reps' | 'reps' | 'time' {
  if (ex.category === 'stretching' || ex.category === 'cardio' || ex.force === 'static') return 'time';
  if (equipment.length === 0 || ex.category === 'plyometrics') return 'reps';
  return 'weight_reps';
}
