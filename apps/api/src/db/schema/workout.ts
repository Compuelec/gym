import { integer, jsonb, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { syncColumns } from '../columns';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const programs = pgTable('programs', {
  ...syncColumns(),
  name: text('name').notNull(),
  weeks: integer('weeks').notNull(),
  source: text('source').notNull(),
  coachRequestId: text('coach_request_id'),
  startedAt: ts('started_at'),
  archivedAt: ts('archived_at'),
  summaryEs: text('summary_es'),
});

export const routines = pgTable('routines', {
  ...syncColumns(),
  name: text('name').notNull(),
  programId: uuid('program_id'),
  weekIndex: integer('week_index'),
  dayIndex: integer('day_index'),
  locationId: uuid('location_id'),
  notes: text('notes'),
  // Replaced as a whole on every edit (small, owned by one user).
  items: jsonb('items').notNull(),
});

export const workoutSessions = pgTable('workout_sessions', {
  ...syncColumns(),
  routineId: uuid('routine_id'),
  locationId: uuid('location_id'),
  name: text('name').notNull(),
  startedAt: ts('started_at').notNull(),
  endedAt: ts('ended_at'),
  status: text('status').notNull(),
  notes: text('notes'),
  perceivedEffort: integer('perceived_effort'),
});

export const sessionExercises = pgTable('session_exercises', {
  ...syncColumns(),
  sessionId: uuid('session_id').notNull(),
  position: integer('position').notNull(),
  exerciseId: text('exercise_id').notNull(),
  replacedFromExerciseId: text('replaced_from_exercise_id'),
  supersetGroup: text('superset_group'),
  restSeconds: integer('rest_seconds').notNull(),
  notes: text('notes'),
  targetSets: integer('target_sets'),
  repMin: integer('rep_min'),
  repMax: integer('rep_max'),
  targetSeconds: integer('target_seconds'),
});

export const setEntries = pgTable('set_entries', {
  ...syncColumns(),
  sessionExerciseId: uuid('session_exercise_id').notNull(),
  position: integer('position').notNull(),
  type: text('type').notNull(),
  weightKg: real('weight_kg'),
  reps: integer('reps'),
  seconds: integer('seconds'),
  meters: real('meters'),
  rir: integer('rir'),
  rpe: real('rpe'),
  completedAt: ts('completed_at').notNull(),
  suggested: jsonb('suggested'),
});
