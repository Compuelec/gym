import { and, asc, eq, getTableColumns, gt, isNull, sql } from 'drizzle-orm';
import type {
  ErrorCode} from '@gym/shared';
import {
  type SyncChange,
  type SyncMutation,
  type SyncMutationResult,
  type SyncPullResponse,
} from '@gym/shared';
import type { Database } from '../db/client';
import { syncMutations } from '../db/schema';
import { MESSAGES } from './errors';
import { SERVER_MANAGED_KEYS, type SyncEntityDef, type SyncRegistry } from './sync-registry';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

class Rejection extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? MESSAGES[code]);
  }
}

const NEXT_VERSION = sql`nextval('sync_version_seq')`;

/**
 * Applies a batch of client mutations for one owner. The whole batch runs in one transaction
 * holding a per-owner advisory lock, so an owner's versions are assigned in commit order and a
 * concurrent pull can never skip a change. Each mutation runs in a savepoint: a rejected one does
 * not undo the others.
 */
export async function pushMutations(
  db: Database,
  registry: SyncRegistry,
  ownerId: string,
  mutations: SyncMutation[],
): Promise<SyncMutationResult[]> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))`);
    const inBatch = new Set<string>();
    const results: SyncMutationResult[] = [];

    for (const m of mutations) {
      const [previous] = await tx
        .select()
        .from(syncMutations)
        .where(eq(syncMutations.mutationId, m.mutationId));
      if (previous) {
        results.push(
          previous.ownerId === ownerId
            ? { mutationId: m.mutationId, status: 'duplicate', serverVersion: previous.resultVersion }
            : reject(m, 'NOT_FOUND'),
        );
        continue;
      }

      let result: SyncMutationResult;
      try {
        const version = await tx.transaction((sp) => applyMutation(sp, registry, ownerId, m, inBatch));
        result = { mutationId: m.mutationId, status: 'applied', serverVersion: version };
        inBatch.add(key(m.entity, m.id));
      } catch (err) {
        if (!(err instanceof Rejection)) throw err;
        result = reject(m, err.code, err.message);
      }

      await tx.insert(syncMutations).values({
        mutationId: m.mutationId,
        ownerId,
        status: result.status === 'applied' ? 'applied' : 'rejected',
        resultVersion: result.status === 'applied' ? result.serverVersion : null,
        errorCode: result.status === 'rejected' ? result.error.code : null,
      });
      results.push(result);
    }
    return results;
  });
}

async function applyMutation(
  tx: Tx,
  registry: SyncRegistry,
  ownerId: string,
  m: SyncMutation,
  inBatch: Set<string>,
): Promise<number> {
  const def = registry.get(m.entity);
  if (!def) throw new Rejection('UNKNOWN_ENTITY');
  const table = def.table;

  if (def.idIsOwnerId && m.id !== ownerId) throw new Rejection('VALIDATION');

  const [existing] = await tx
    .select({ ownerId: table.ownerId })
    .from(table)
    .where(eq(table.id, m.id));
  // Never reveal that another user's record exists.
  if (existing && existing.ownerId !== ownerId) throw new Rejection('NOT_FOUND');

  if (m.op === 'delete') {
    if (!existing) return 0;
    const [row] = await tx
      .update(table)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()`, serverVersion: NEXT_VERSION })
      .where(and(eq(table.id, m.id), eq(table.ownerId, ownerId)))
      .returning({ serverVersion: table.serverVersion });
    return Number(row?.serverVersion);
  }

  const data = validate(def, m.data ?? {});
  await checkReferences(tx, registry, def, ownerId, data, inBatch);

  const values = { ...data, id: m.id, ownerId, updatedAt: sql`now()`, deletedAt: null, serverVersion: NEXT_VERSION };
  const [row] = await tx
    .insert(table)
    .values(values)
    .onConflictDoUpdate({
      target: table.id,
      set: { ...data, updatedAt: sql`now()`, deletedAt: null, serverVersion: NEXT_VERSION },
      // Repeat the owner check at write time: another user inserting the same id concurrently
      // (the advisory lock is per owner) must never be overwritten.
      setWhere: eq(table.ownerId, ownerId),
    })
    .returning({ serverVersion: table.serverVersion });
  if (!row) throw new Rejection('NOT_FOUND');
  return Number(row.serverVersion);
}

function validate(def: SyncEntityDef, raw: Record<string, unknown>) {
  const clientData = Object.fromEntries(
    Object.entries(raw).filter(([k]) => !SERVER_MANAGED_KEYS.has(k)),
  );
  const parsed = def.schema.safeParse(clientData);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || '(raíz)').join(', ');
    throw new Rejection('VALIDATION', `${MESSAGES.VALIDATION} Revisa: ${fields}.`);
  }
  return parsed.data;
}

async function checkReferences(
  tx: Tx,
  registry: SyncRegistry,
  def: SyncEntityDef,
  ownerId: string,
  data: Record<string, unknown>,
  inBatch: Set<string>,
) {
  for (const ref of def.references?.(data) ?? []) {
    if (inBatch.has(key(ref.entity, ref.id))) continue;
    const target = registry.get(ref.entity);
    if (!target) throw new Rejection('REFERENCE');
    const [found] = await tx
      .select({ id: target.table.id })
      .from(target.table)
      .where(and(eq(target.table.id, ref.id), eq(target.table.ownerId, ownerId), ref.allowDeleted ? undefined : isNull(target.table.deletedAt)));
    if (!found) throw new Rejection('REFERENCE');
  }
}

/** Returns the owner's changes after `cursor`, across all entities, ordered by version. */
export async function pullChanges(
  db: Database,
  registry: SyncRegistry,
  ownerId: string,
  cursor: number,
  limit: number,
): Promise<SyncPullResponse> {
  const perEntity = await Promise.all(
    registry.all().map(async (def) => {
      const rows = await db
        .select()
        .from(def.table)
        .where(and(eq(def.table.ownerId, ownerId), gt(def.table.serverVersion, cursor)))
        .orderBy(asc(def.table.serverVersion))
        .limit(limit + 1);
      const timestampKeys = timestampColumns(def);
      return rows.map((row) => toChange(def.name, row as Record<string, unknown>, timestampKeys));
    }),
  );
  const all = perEntity.flat().sort((a, b) => a.serverVersion - b.serverVersion);
  const changes = all.slice(0, limit);
  const last = changes.at(-1);
  return { changes, cursor: last ? last.serverVersion : cursor, hasMore: all.length > limit };
}

/** Keys of timestamp columns; Postgres returns them as "2026-11-23 03:16:11+00", not ISO. */
const timestampCache = new WeakMap<SyncEntityDef, Set<string>>();
function timestampColumns(def: SyncEntityDef) {
  let keys = timestampCache.get(def);
  if (!keys) {
    keys = new Set(
      Object.entries(getTableColumns(def.table))
        .filter(([, col]) => col.columnType.startsWith('PgTimestamp'))
        .map(([key]) => key),
    );
    timestampCache.set(def, keys);
  }
  return keys;
}

function toChange(entity: string, row: Record<string, unknown>, timestampKeys: Set<string>): SyncChange {
  const { id, ownerId: _owner, serverVersion, deletedAt, ...rest } = row;
  // Always send ISO 8601 so the client can push the same record back unchanged.
  const data = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [
      k,
      v instanceof Date ? v.toISOString() : timestampKeys.has(k) && typeof v === 'string' ? new Date(v).toISOString() : v,
    ]),
  );
  return { entity, id: String(id), serverVersion: Number(serverVersion), deleted: deletedAt != null, data };
}

function reject(m: SyncMutation, code: ErrorCode, message?: string): SyncMutationResult {
  return { mutationId: m.mutationId, status: 'rejected', error: { code, message: message ?? MESSAGES[code] } };
}

const key = (entity: string, id: string) => `${entity}:${id}`;
