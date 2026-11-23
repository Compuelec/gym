import { bigint, pgSequence, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Global, monotonic version counter for sync. Every applied change takes the next value and
 * clients pull by cursor (`serverVersion > cursor`), so client clocks never matter.
 */
export const syncVersionSeq = pgSequence('sync_version_seq', { startWith: 1 });

/** Columns shared by every user-owned, synchronizable entity. */
export function syncColumns() {
  return {
    id: uuid('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    serverVersion: bigint('server_version', { mode: 'number' })
      .notNull()
      .default(sql`nextval('sync_version_seq')`),
  };
}
