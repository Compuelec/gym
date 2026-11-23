import { pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';
import { syncColumns } from '../columns';

export const bodyMeasurements = pgTable('body_measurements', {
  ...syncColumns(),
  measuredAt: timestamp('measured_at', { withTimezone: true, mode: 'string' }).notNull(),
  weightKg: real('weight_kg'),
  bodyFatPct: real('body_fat_pct'),
  waistCm: real('waist_cm'),
  chestCm: real('chest_cm'),
  armCm: real('arm_cm'),
  thighCm: real('thigh_cm'),
  notes: text('notes'),
});
