import { pgTable, text } from 'drizzle-orm/pg-core';
import { syncColumns } from '../columns';

/** Private exercises created by a user (the base catalog is a static file, not in the DB). */
export const exercises = pgTable('exercises', {
  ...syncColumns(),
  nameEs: text('name_es').notNull(),
  instructionsEs: text('instructions_es').array().notNull(),
  primaryMuscles: text('primary_muscles').array().notNull(),
  secondaryMuscles: text('secondary_muscles').array().notNull(),
  equipment: text('equipment').array().notNull(),
  level: text('level').notNull(),
  category: text('category').notNull(),
  mechanic: text('mechanic'),
  force: text('force'),
  measure: text('measure').notNull(),
  notes: text('notes'),
});

export const favorites = pgTable('favorites', {
  ...syncColumns(),
  // A catalog id ("fedb:…") or the id of one of the user's own exercises.
  exerciseId: text('exercise_id').notNull(),
});
