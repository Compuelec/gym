import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Scheduled notifications (rest timer, reminders, weekly summary); the worker sends due rows and
 * marks them sent. Title/body/url override the default rest message.
 */
export const scheduledPushes = pgTable(
  'scheduled_pushes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    sessionId: uuid('session_id'),
    kind: text('kind').notNull(),
    title: text('title'),
    body: text('body'),
    url: text('url'),
    fireAt: timestamp('fire_at', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('scheduled_pushes_due_idx').on(t.fireAt)],
);

/** One reminder / weekly summary per person per local day: the worker never sends twice. */
export const notificationLog = pgTable(
  'notification_log',
  {
    ownerId: text('owner_id').notNull(),
    kind: text('kind').notNull(),
    localDate: text('local_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.kind, t.localDate] })],
);
