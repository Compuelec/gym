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
