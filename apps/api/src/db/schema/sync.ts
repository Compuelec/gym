import { bigint, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Applied client mutations, so a repeated mutationId returns the same result (idempotency). */
export const syncMutations = pgTable('sync_mutations', {
  mutationId: text('mutation_id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  appliedAt: timestamp('applied_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status', { enum: ['applied', 'rejected'] }).notNull(),
  resultVersion: bigint('result_version', { mode: 'number' }),
  errorCode: text('error_code'),
});
