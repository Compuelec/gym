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
 * Corrections to upstream equipment, by free-exercise-db id, reviewed by hand. The source marks
 * bar exercises as "body only" (which would offer pull-ups at home without a bar) and lumps very
 * different gear under "other" (sled, plates, parallel bars, boxes…): each one gets the real
 * equipment so «Casa» only offers what is actually there. Strongman implements stay "other".
 */
export const EQUIPMENT_OVERRIDES: Record<string, string[]> = {
  // Pull-up bar
  'Band_Assisted_Pull-Up': ['pull_up_bar', 'band'],
  'Chin-Up': ['pull_up_bar'],
  Gironda_Sternum_Chins: ['pull_up_bar'],
  Hanging_Leg_Raise: ['pull_up_bar'],
  Hanging_Pike: ['pull_up_bar'],
  Kipping_Muscle_Up: ['pull_up_bar'],
  Mixed_Grip_Chin: ['pull_up_bar'],
  Muscle_Up: ['pull_up_bar'],
  'One_Arm_Chin-Up': ['pull_up_bar'],
  One_Handed_Hang: ['pull_up_bar'],
  Pullups: ['pull_up_bar'],
  'Rocky_Pull-Ups_Pulldowns': ['pull_up_bar'],
  'Scapular_Pull-Up': ['pull_up_bar'],
  Side_To_Side_Chins: ['pull_up_bar'],
  'V-Bar_Pullup': ['pull_up_bar'],
  Weighted_Pull_Ups: ['pull_up_bar', 'plate'],
  'Wide-Grip_Rear_Pull-Up': ['pull_up_bar'],
  Bodyweight_Mid_Row: ['pull_up_bar'],
  // Parallel bars
  'Dips_-_Chest_Version': ['dip_bars'],
  'Dips_-_Triceps_Version': ['dip_bars'],
  Parallel_Bar_Dip: ['dip_bars'],
  Knee_Hip_Raise_On_Parallel_Bars: ['dip_bars'],
  // Suspension trainer (TRX) or rings
  Inverted_Row_with_Straps: ['suspension'],
  Ring_Dips: ['suspension'],
  Suspended_Fallout: ['suspension'],
  'Suspended_Push-Up': ['suspension'],
  Suspended_Reverse_Crunch: ['suspension'],
  Suspended_Row: ['suspension'],
  Suspended_Split_Squat: ['suspension'],
  // Weight plates
  Front_Plate_Raise: ['plate'],
  Lying_Face_Down_Plate_Neck_Resistance: ['plate'],
  Lying_Face_Up_Plate_Neck_Resistance: ['plate'],
  'Otis-Up': ['plate'],
  Plate_Pinch: ['plate'],
  Plate_Twist: ['plate'],
  Reverse_Plate_Curls: ['plate'],
  Standing_Olympic_Plate_Hand_Squeeze: ['plate'],
  Svend_Press: ['plate'],
  Weighted_Squat: ['bench', 'plate'],
  Weighted_Bench_Dip: ['bench', 'plate'],
  // Bench
  Bench_Dips: ['bench'],
  Bench_Jump: ['bench'],
  Bench_Sprint: ['bench'],
  'Flat_Bench_Leg_Pull-In': ['bench'],
  Flat_Bench_Lying_Leg_Raise: ['bench'],
  'Seated_Flat_Bench_Leg_Pull-In': ['bench'],
  Standing_Elevated_Quad_Stretch: ['bench'],
  Seated_Band_Hamstring_Curl: ['bench', 'band'],
  'Weighted_Sit-Ups_-_With_Bands': ['bench', 'band'],
  Chain_Handle_Extension: ['bench', 'other'],
  Chain_Press: ['bench', 'other'],
  // Plyo box or step
  Box_Jump_Multiple_Response: ['box'],
  Box_Skip: ['box'],
  Depth_Jump_Leap: ['box'],
  Drop_Push: ['box'],
  Front_Box_Jump: ['box'],
  'Incline_Push-Up_Depth_Jump': ['box'],
  Lateral_Box_Jump: ['box'],
  Linear_Depth_Jump: ['box'],
  Quick_Leap: ['box'],
  Side_to_Side_Box_Shuffle: ['box'],
  'Single-Leg_High_Box_Squat': ['box'],
  'Single-Leg_Stride_Jump': ['box'],
  'Single_Leg_Push-off': ['box'],
  'Step-up_with_Knee_Raise': ['box'],
  Stride_Jump_Crossover: ['box'],
  // Cones or hurdles
  Front_Cone_Hops_or_hurdle_hops: ['cones'],
  Hurdle_Hops: ['cones'],
  Lateral_Cone_Hops: ['cones'],
  'Side_Hop-Sprint': ['cones'],
  'Single-Cone_Sprint_Drill': ['cones'],
  'Single-Leg_Hop_Progression': ['cones'],
  'Single-Leg_Lateral_Hop': ['cones'],
  // Sled
  Backward_Drag: ['sled'],
  Bear_Crawl_Sled_Drags: ['sled'],
  Forward_Drag_with_Press: ['sled'],
  Prowler_Sprint: ['sled'],
  'Sled_Drag_-_Harness': ['sled'],
  Sled_Overhead_Backward_Walk: ['sled'],
  Sled_Overhead_Triceps_Extension: ['sled'],
  Sled_Push: ['sled'],
  Sled_Reverse_Flye: ['sled'],
  Sled_Row: ['sled'],
  // Cardio machines
  Bicycling_Stationary: ['stationary_bike'],
  Recumbent_Bike: ['stationary_bike'],
  Elliptical_Trainer: ['elliptical'],
  Jogging_Treadmill: ['treadmill'],
  Running_Treadmill: ['treadmill'],
  Walking_Treadmill: ['treadmill'],
  Rowing_Stationary: ['rower'],
  Stairmaster: ['stair_climber'],
  Step_Mill: ['stair_climber'],
  // Other specific gear
  Ab_Roller: ['ab_wheel'],
  Battling_Ropes: ['battle_rope'],
  Rope_Jumping: ['jump_rope'],
  Trap_Bar_Deadlift: ['trap_bar'],
  Hyperextensions_Back_Extensions: ['hyper_bench'],
  Donkey_Calf_Raises: ['machine'],
  Farmers_Walk: ['dumbbell'],
  Crucifix: ['dumbbell'],
  'Anterior_Tibialis-SMR': ['foam_roll'],
  'Foot-SMR': ['foam_roll'],
  'Neck-SMR': ['foam_roll'],
  // Nothing but the floor, a wall, a chair or a partner
  Behind_Head_Chest_Stretch: [],
  Chair_Leg_Extended_Stretch: [],
  Chair_Upper_Body_Stretch: [],
  Chest_And_Front_Of_Shoulder_Stretch: [],
  IT_Band_and_Glute_Stretch: [],
  Intermediate_Groin_Stretch: [],
  Intermediate_Hip_Flexor_and_Quad_Stretch: [],
  Lying_Bent_Leg_Groin: [],
  Lying_Hamstring: [],
  'On-Your-Back_Quad_Stretch': [],
  Overhead_Lat: [],
  Peroneals_Stretch: [],
  Platform_Hamstring_Slides: [],
  Posterior_Tibialis_Stretch: [],
  Quad_Stretch: [],
  Round_The_World_Shoulder_Stretch: [],
  Seated_Hamstring_and_Calf_Stretch: [],
  Standing_Biceps_Stretch: [],
  Standing_Hamstring_and_Calf_Stretch: [],
  // Everything else under "other" (tire, atlas stones, log, yoke, keg, bike, skates, heavy bag,
  // balance board, wrist roller, climbing rope, head harness, sledgehammer) stays "other".
};

/** Free-weight exercises done lying or sitting on a (flat, incline, decline or preacher) bench. */
const NEEDS_BENCH = /bench|incline|decline|preacher|lying|prone/i;
const FREE_WEIGHTS = new Set(['dumbbell', 'barbell', 'ez_bar', 'kettlebell']);

export function exerciseEquipment(ex: { id: string; name?: string; equipment: string | null }): string[] {
  const base = EQUIPMENT_OVERRIDES[ex.id] ?? mapEquipment(ex.equipment);
  // The source lists only the weight: «Press de banca con mancuernas» also needs the bench.
  if (ex.name && NEEDS_BENCH.test(ex.name) && base.some((e) => FREE_WEIGHTS.has(e)) && !base.includes('bench') && !/smith|box jump/i.test(ex.name)) {
    return [...base, 'bench'];
  }
  return base;
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
