import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Sign-up invitations. Only a SHA-256 hash of the code is stored. */
export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeHash: text('code_hash').notNull().unique(),
    createdBy: text('created_by'),
    email: text('email'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Set atomically when a sign-up consumes the code; usedBy is filled once the user exists.
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedEmail: text('used_email'),
    usedBy: text('used_by'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invitations_used_email_idx').on(t.usedEmail)],
);
