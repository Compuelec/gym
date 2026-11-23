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
  // Added by user stories, e.g. location: 'id, serverVersion'
};

export class GymDB extends Dexie {
  outbox!: EntityTable<OutboxItem, 'seq'>;
  meta!: EntityTable<MetaItem, 'key'>;

  constructor(name = 'gym', entityStores: Record<string, string> = ENTITY_STORES) {
    super(name);
    this.version(1).stores({
      outbox: '++seq, mutationId, [entity+id]',
      meta: 'key',
      ...entityStores,
    });
  }

  entityTable(entity: string): Table<SyncedRecord, string> {
    return this.table(entity);
  }

  entityNames(): string[] {
    return this.tables.map((t) => t.name).filter((n) => n !== 'outbox' && n !== 'meta');
  }
}

let instance: GymDB | undefined;
export function getDB(): GymDB {
  instance ??= new GymDB();
  return instance;
}
