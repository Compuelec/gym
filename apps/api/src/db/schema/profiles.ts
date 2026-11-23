import { boolean, integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { syncColumns } from '../columns';

/** One per user; `id` equals the user id so two devices converge on the same profile. */
export const profiles = pgTable('profiles', {
  ...syncColumns(),
  goal: text('goal').notNull(),
  level: text('level').notNull(),
  daysPerWeek: integer('days_per_week').notNull(),
  sessionMinutes: integer('session_minutes').notNull(),
  units: text('units').notNull(),
  bodyweightKg: real('bodyweight_kg'),
  birthYear: integer('birth_year'),
  sex: text('sex'),
  medicalAckAt: timestamp('medical_ack_at', { withTimezone: true, mode: 'string' }).notNull(),
});

export const locations = pgTable('locations', {
  ...syncColumns(),
  name: text('name').notNull(),
  equipment: text('equipment').array().notNull(),
  isDefault: boolean('is_default').notNull().default(false),
});
