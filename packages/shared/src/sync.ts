import { z } from 'zod';
import { IsoDateSchema, UuidSchema } from './common';

export const SYNC_PUSH_MAX_BATCH = 200;
export const SYNC_PULL_DEFAULT_LIMIT = 500;

export const SyncMutationSchema = z.object({
  mutationId: UuidSchema,
  entity: z.string().min(1).max(64),
  op: z.enum(['upsert', 'delete']),
  id: UuidSchema,
  data: z.record(z.string(), z.unknown()).optional(),
  clientUpdatedAt: IsoDateSchema,
});
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

export const SyncPushRequestSchema = z.object({
  clientId: UuidSchema,
  mutations: z.array(SyncMutationSchema).min(1).max(SYNC_PUSH_MAX_BATCH),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncMutationResultSchema = z.discriminatedUnion('status', [
  z.object({ mutationId: z.string(), status: z.literal('applied'), serverVersion: z.number() }),
  z.object({ mutationId: z.string(), status: z.literal('duplicate'), serverVersion: z.number().nullable() }),
  z.object({
    mutationId: z.string(),
    status: z.literal('rejected'),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);
export type SyncMutationResult = z.infer<typeof SyncMutationResultSchema>;

export const SyncPushResponseSchema = z.object({ results: z.array(SyncMutationResultSchema) });
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;

export const SyncChangeSchema = z.object({
  entity: z.string(),
  id: z.string(),
  serverVersion: z.number(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown()),
});
export type SyncChange = z.infer<typeof SyncChangeSchema>;

export const SyncPullResponseSchema = z.object({
  changes: z.array(SyncChangeSchema),
  cursor: z.number(),
  hasMore: z.boolean(),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;
