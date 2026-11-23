import Dexie, { type EntityTable, type Table } from 'dexie';

/** A pending change waiting to be pushed to the server. */
export interface OutboxItem {
  seq?: number;
  mutationId: string;
  entity: string;
  op: 'upsert' | 'delete';
  id: string;
  data?: Record<string, unknown>;
  clientUpdatedAt: string;
  attempts: number;
}

export interface MetaItem {
  key: string;
  value: unknown;
}

/** Fields every synchronized record carries locally. */
export interface SyncedRecord {
  id: string;
  serverVersion?: number;
  [field: string]: unknown;
}

/**
 * Local database. Entity stores are declared per user story; each schema change adds a new
 * Dexie version (never edit an old one). Entity stores are keyed by `id`.
 */
export const ENTITY_STORES: Record<string, string> = {
  // US1
  profile: 'id',
  location: 'id, serverVersion',
  // US2
  exercise: 'id, serverVersion',
  favorite: 'id, exerciseId',
  // US3
  program: 'id',
  routine: 'id',
  workoutSession: 'id, status, startedAt',
  sessionExercise: 'id, sessionId, exerciseId',
  setEntry: 'id, sessionExerciseId',
  // US5
  bodyMeasurement: 'id, measuredAt',
};

/** Local-only stores (not synced): the base exercise catalog. */
export const LOCAL_STORES: Record<string, string> = {
  catalog: 'id',
};

export class GymDB extends Dexie {
  outbox!: EntityTable<OutboxItem, 'seq'>;
  meta!: EntityTable<MetaItem, 'key'>;

  constructor(name = 'gym', entityStores: Record<string, string> = ENTITY_STORES) {
    super(name);
    this.version(1).stores({
      outbox: '++seq, mutationId, [entity+id]',
      meta: 'key',
      ...LOCAL_STORES,
      ...entityStores,
    });
  }

  entityTable(entity: string): Table<SyncedRecord, string> {
    return this.table(entity);
  }

  entityNames(): string[] {
    return this.tables.map((t) => t.name).filter((n) => n !== 'outbox' && n !== 'meta' && !(n in LOCAL_STORES));
  }
}

/** One local database per user, so two people sharing a device never see each other's data. */
const instances = new Map<string, GymDB>();
export function getDB(userId: string): GymDB {
  let db = instances.get(userId);
  if (!db) {
    db = new GymDB(`gym-${userId}`);
    instances.set(userId, db);
  }
  return db;
}

/** Deletes a user's local database (on explicit sign-out, after syncing). */
export async function deleteLocalData(userId: string) {
  const db = instances.get(userId) ?? new GymDB(`gym-${userId}`);
  instances.delete(userId);
  db.close();
  await db.delete();
}
