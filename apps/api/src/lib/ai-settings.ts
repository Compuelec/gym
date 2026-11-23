import { gte, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { adminAudit, appSettings, coachRequests, AI_MODELS } from '../db/schema';
import type { Env } from '../env';
import { last4, open, seal } from './crypto';

export type Settings = typeof appSettings.$inferSelect;
export type Unavailable = 'DISABLED' | 'NO_KEY' | 'PAUSED';

export async function getSettings(db: Database): Promise<Settings> {
  await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(appSettings);
  return row!;
}

export async function updateSettings(db: Database, patch: Partial<Settings>, adminId: string | null) {
  await getSettings(db);
  await db.update(appSettings).set({ ...patch, updatedBy: adminId, updatedAt: sql`now()` });
}

/** Decrypted key from the admin screen, else the optional Secret fallback, else null. */
export function resolveKey(row: Settings, config: Env): string | null {
  if (row.aiApiKeyCiphertext && row.aiApiKeyIv && row.aiApiKeyTag) {
    return open({ ciphertext: row.aiApiKeyCiphertext, iv: row.aiApiKeyIv, tag: row.aiApiKeyTag }, config.APP_ENCRYPTION_KEY);
  }
  return config.ANTHROPIC_API_KEY ?? null;
}

export function keyConfigured(row: Settings, config: Env) {
  return Boolean(row.aiApiKeyCiphertext) || Boolean(config.ANTHROPIC_API_KEY);
}

/** The coach works only when the admin enabled it, there is a key, and it is not paused. */
export function availability(row: Settings, config: Env): { available: true } | { available: false; reason: Unavailable } {
  if (!row.aiEnabled) return { available: false, reason: 'DISABLED' };
  if (!keyConfigured(row, config)) return { available: false, reason: 'NO_KEY' };
  if (row.aiPausedReason) return { available: false, reason: 'PAUSED' };
  return { available: true };
}

export async function monthSpendUsd(db: Database): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${coachRequests.costUsd}), 0)` })
    .from(coachRequests)
    .where(gte(coachRequests.createdAt, sql`date_trunc('month', now())`));
  return Number(row?.total ?? 0);
}

export async function publicView(db: Database, config: Env) {
  const row = await getSettings(db);
  const status = availability(row, config);
  return {
    enabled: row.aiEnabled,
    available: status.available,
    reason: status.available ? null : status.reason,
    model: row.aiModel,
    allowedModels: AI_MODELS,
    keyConfigured: keyConfigured(row, config),
    keySource: row.aiApiKeyCiphertext ? 'admin' : config.ANTHROPIC_API_KEY ? 'secret' : null,
    keyLast4: row.aiApiKeyLast4,
    keyUpdatedAt: row.aiApiKeyUpdatedAt?.toISOString() ?? null,
    dailyLimitPerUser: row.aiDailyLimitPerUser,
    monthlyBudgetUsd: row.aiMonthlyBudgetUsd,
    monthSpentUsd: Math.round((await monthSpendUsd(db)) * 10000) / 10000,
    pausedReason: row.aiPausedReason,
    encryptionReady: Boolean(config.APP_ENCRYPTION_KEY),
  };
}

export async function storeKey(db: Database, config: Env, apiKey: string, adminId: string) {
  const sealed = seal(apiKey, config.APP_ENCRYPTION_KEY);
  await updateSettings(
    db,
    {
      aiApiKeyCiphertext: sealed.ciphertext,
      aiApiKeyIv: sealed.iv,
      aiApiKeyTag: sealed.tag,
      aiApiKeyLast4: last4(apiKey),
      aiApiKeyUpdatedAt: new Date(),
      // A new key clears a pause caused by the old one.
      ...(await getSettings(db).then((r) => (r.aiPausedReason === 'KEY_REJECTED' ? { aiPausedReason: null } : {}))),
    },
    adminId,
  );
}

export async function audit(db: Database, adminId: string, action: string, details: Record<string, unknown> = {}) {
  await db.insert(adminAudit).values({ adminId, action, details });
}
