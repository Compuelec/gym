import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { z } from 'zod';

/** A Drizzle table built with `syncColumns()` plus entity-specific columns. */
export type SyncTable = PgTable & {
  id: PgColumn;
  ownerId: PgColumn;
  createdAt: PgColumn;
  updatedAt: PgColumn;
  deletedAt: PgColumn;
  serverVersion: PgColumn;
};

export interface SyncEntityDef {
  /** Entity name used on the wire (e.g. "location", "setEntry"). */
  name: string;
  table: SyncTable;
  /**
   * Validates client data. Keys must match the table's TypeScript column keys; timestamp columns
   * use `mode: 'string'` so ISO strings pass through unchanged.
   */
  schema: z.ZodType<Record<string, unknown>>;
  /** Other records this one points to; they must exist for the same owner (same batch or DB). */
  /**
   * Rows this one points to; they must belong to the same owner. `allowDeleted` accepts a
   * soft-deleted target (e.g. finishing offline a session whose location was deleted meanwhile).
   */
  references?: (data: Record<string, unknown>) => Array<{ entity: string; id: string; allowDeleted?: boolean }>;
  /** One record per user whose id must equal the user's id (e.g. profile). */
  idIsOwnerId?: boolean;
}

export class SyncRegistry {
  private readonly entities = new Map<string, SyncEntityDef>();

  constructor(defs: SyncEntityDef[] = []) {
    for (const def of defs) this.register(def);
  }

  register(def: SyncEntityDef) {
    if (this.entities.has(def.name)) throw new Error(`Sync entity already registered: ${def.name}`);
    this.entities.set(def.name, def);
  }

  get(name: string) {
    return this.entities.get(name);
  }

  all() {
    return [...this.entities.values()];
  }
}

/** Columns managed by the server and never accepted from the client. */
export const SERVER_MANAGED_KEYS = new Set([
  // Set only by the server when a coach program is accepted.
  'coachRequestId',
  'id',
  'ownerId',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'serverVersion',
]);
