import { boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const AI_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] as const;
export type AiModel = (typeof AI_MODELS)[number];

/** Global settings, one row (id = 1). Only admins read or change them. */
export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  aiEnabled: boolean('ai_enabled').notNull().default(false),
  aiModel: text('ai_model', { enum: AI_MODELS }).notNull().default('claude-haiku-5-5'),
  // AES-256-GCM with APP_ENCRYPTION_KEY (Kubernetes Secret): the database alone never reveals it.
  aiApiKeyCiphertext: text('ai_api_key_ciphertext'),
  aiApiKeyIv: text('ai_api_key_iv'),
  aiApiKeyTag: text('ai_api_key_tag'),
  aiApiKeyLast4: text('ai_api_key_last4'),
  aiApiKeyUpdatedAt: timestamp('ai_api_key_updated_at', { withTimezone: true }),
  aiDailyLimitPerUser: integer('ai_daily_limit_per_user').notNull().default(20),
  aiMonthlyBudgetUsd: numeric('ai_monthly_budget_usd', { precision: 10, scale: 2, mode: 'number' }).notNull().default(5),
  aiPausedReason: text('ai_paused_reason'),
  aiPricing: jsonb('ai_pricing'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminAudit = pgTable('admin_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: text('admin_id').notNull(),
  action: text('action').notNull(),
  // Never secrets: only what changed (e.g. model names, limits, last 4 characters).
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Coach requests (US6); here because the monthly AI spend is computed from them. */
export const coachRequests = pgTable('coach_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: text('owner_id').notNull(),
  kind: text('kind', { enum: ['program', 'weekly_review'] }).notNull(),
  messages: jsonb('messages').notNull(),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed', 'rejected'] }).notNull(),
  resultJson: jsonb('result_json'),
  validationErrors: jsonb('validation_errors'),
  errorMessage: text('error_message'),
  model: text('model'),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6, mode: 'number' }).notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
