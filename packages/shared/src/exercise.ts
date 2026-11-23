import { z } from 'zod';
import { CATEGORY_SLUGS, EQUIPMENT_SLUGS, MUSCLE_SLUGS } from './vocabulary';

export const MEASURES = ['weight_reps', 'reps', 'time', 'distance'] as const;
export const EXERCISE_LEVELS = ['beginner', 'intermediate', 'expert'] as const;

export const MediaSchema = z.object({
  type: z.enum(['image', 'video']),
  url: z.string().min(1),
  author: z.string().nullable(),
  license: z.string().min(1),
  sourceUrl: z.string().nullable(),
});
export type Media = z.infer<typeof MediaSchema>;

/** Fields shared by base catalog exercises and user-created ones. */
const ExerciseCore = {
  nameEs: z.string().trim().min(1).max(120),
  instructionsEs: z.array(z.string().trim().min(1).max(1000)).max(20),
  primaryMuscles: z.array(z.enum(MUSCLE_SLUGS)).min(1).max(6),
  secondaryMuscles: z.array(z.enum(MUSCLE_SLUGS)).max(10),
  equipment: z.array(z.enum(EQUIPMENT_SLUGS)).max(6),
  level: z.enum(EXERCISE_LEVELS),
  category: z.enum(CATEGORY_SLUGS),
  mechanic: z.enum(['compound', 'isolation']).nullable(),
  force: z.enum(['push', 'pull', 'static']).nullable(),
  measure: z.enum(MEASURES),
};

/** A base catalog exercise (read-only, shipped in the catalog package). */
export const CatalogExerciseSchema = z.object({
  id: z.string().regex(/^(fedb|wger):[\w.-]+$/),
  ...ExerciseCore,
  nameEn: z.string().nullable(),
  // false while the Spanish text is still the English fallback (pending translation).
  translated: z.boolean(),
  media: z.array(MediaSchema),
  source: z.enum(['free-exercise-db', 'wger']),
  license: z.string().min(1),
  authors: z.array(z.string()),
  sourceUrl: z.string().nullable(),
  catalogVersion: z.number().int(),
  retiredAt: z.string().nullable(),
});
export type CatalogExercise = z.infer<typeof CatalogExerciseSchema>;

/** A private exercise created by the user (synced entity `exercise`). */
export const OwnExerciseSchema = z.object({
  ...ExerciseCore,
  instructionsEs: z.array(z.string().trim().min(1).max(1000)).max(20),
  notes: z.string().max(1000).nullable().optional(),
});
export type OwnExercise = z.infer<typeof OwnExerciseSchema>;

export const FavoriteSchema = z.object({ exerciseId: z.string().min(1).max(80) });
export type Favorite = z.infer<typeof FavoriteSchema>;

export const CatalogManifestSchema = z.object({
  version: z.number().int(),
  file: z.string(),
  sha256: z.string(),
  sizeBytes: z.number().int(),
  exerciseCount: z.number().int(),
  imageCount: z.number().int(),
  translatedCount: z.number().int(),
});
export type CatalogManifest = z.infer<typeof CatalogManifestSchema>;

export const CatalogFileSchema = z.object({
  version: z.number().int(),
  generatedAt: z.string(),
  exercises: z.array(CatalogExerciseSchema),
  credits: z.array(z.object({ source: z.string(), license: z.string(), url: z.string(), authors: z.array(z.string()), count: z.number() })),
});
export type CatalogFile = z.infer<typeof CatalogFileSchema>;
