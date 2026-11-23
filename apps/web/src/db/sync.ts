import {
  SYNC_PUSH_MAX_BATCH,
  uuidv7,
  type SyncMutationResult,
  type SyncPullResponse,
  type SyncPushRequest,
} from '@gym/shared';
import type { GymDB, OutboxItem, SyncedRecord } from './database';
import { safeWrite } from './safe-write';

export class UnauthorizedError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'UnauthorizedError';
  }
}

/** Network layer, injected so the engine is testable without a server. */
export interface SyncTransport {
  push(body: SyncPushRequest): Promise<SyncMutationResult[]>;
  pull(cursor: number): Promise<SyncPullResponse>;
}

export interface SyncEnv {
  isOnline: () => boolean;
  /** Schedules a retry; injectable for tests. */
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
}

const defaultEnv: SyncEnv = { isOnline: () => navigator.onLine };

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'auth_required';

export interface SyncState {
  status: SyncStatus;
  pending: number;
  lastSyncedAt: string | null;
  rejected: number;
}

const CURSOR_KEY = 'syncCursor';
const CLIENT_ID_KEY = 'clientId';
const REJECTED_KEY = 'rejectedMutations';
export const MIN_BACKOFF_MS = 1_000;
export const MAX_BACKOFF_MS = 5 * 60_000;
export const PERIODIC_SYNC_MS = 60_000;

/** Exponential backoff 1 s → 5 min. */
export function backoffDelay(attempt: number): number {
  return Math.min(MIN_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
}

/**
 * Writes a record locally and queues it for the server in the same transaction: either both
 * happen or neither does, so a change can never be lost between the two.
 */
export async function saveRecord(db: GymDB, entity: string, record: SyncedRecord) {
  const { serverVersion: _v, ...data } = record;
  await safeWrite(() =>
    db.transaction('rw', db.entityTable(entity), db.outbox, async () => {
      await db.entityTable(entity).put(record);
      await db.outbox.add(outboxItem(entity, 'upsert', record.id, withoutId(data)));
    }),
  );
}

export async function deleteRecord(db: GymDB, entity: string, id: string) {
  await safeWrite(() =>
    db.transaction('rw', db.entityTable(entity), db.outbox, async () => {
      await db.entityTable(entity).delete(id);
      await db.outbox.add(outboxItem(entity, 'delete', id));
    }),
  );
}

function outboxItem(entity: string, op: 'upsert' | 'delete', id: string, data?: Record<string, unknown>): OutboxItem {
  return { mutationId: uuidv7(), entity, op, id, data, clientUpdatedAt: new Date().toISOString(), attempts: 0 };
}

function withoutId(data: Record<string, unknown>) {
  const { id: _id, ...rest } = data;
  return rest;
}

/**
 * Push-then-pull sync engine. Never drops the outbox on errors; on 401 it stops and waits for the
 * user to sign in again, keeping every pending change.
 */
export class SyncEngine {
  private state: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, rejected: 0 };
  private listeners = new Set<(s: SyncState) => void>();
  private running: Promise<void> | null = null;
  private again = false;
  private failures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private intervalTimer: ReturnType<typeof setInterval> | undefined;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly db: GymDB,
    private readonly transport: SyncTransport,
    private readonly env: SyncEnv = defaultEnv,
  ) {}

  getState() {
    return this.state;
  }

  subscribe(fn: (s: SyncState) => void) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  /** Starts automatic triggers: back online, app visible, and every 60 s. */
  start() {
    const onOnline = () => void this.sync();
    const onVisible = () => document.visibilityState === 'visible' && void this.sync();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    this.intervalTimer = setInterval(() => void this.sync(), PERIODIC_SYNC_MS);
    this.cleanups.push(
      () => window.removeEventListener('online', onOnline),
      () => document.removeEventListener('visibilitychange', onVisible),
    );
    void this.sync();
  }

  stop() {
    this.cleanups.splice(0).forEach((fn) => fn());
    clearInterval(this.intervalTimer);
    clearTimeout(this.retryTimer);
  }

  /** Runs one push+pull cycle; concurrent calls coalesce into one extra run. */
  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.cycle().finally(() => {
      this.running = null;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    return this.running;
  }

  private async cycle() {
    clearTimeout(this.retryTimer);
    await this.refreshPending();
    if (!this.env.isOnline()) return this.update({ status: 'offline' });
    this.update({ status: 'syncing' });
    try {
      await this.pushAll();
      await this.pullAll();
      this.failures = 0;
      await this.refreshPending();
      this.update({ status: 'idle', lastSyncedAt: new Date().toISOString() });
    } catch (err) {
      if (err instanceof UnauthorizedError) return this.update({ status: 'auth_required' });
      const delay = backoffDelay(this.failures);
      this.failures += 1;
      this.retryTimer = (this.env.schedule ?? setTimeout)(() => void this.sync(), delay);
      this.update({ status: this.env.isOnline() ? 'error' : 'offline' });
    }
  }

  private async pushAll() {
    const clientId = await this.clientId();
    for (;;) {
      const batch = await this.db.outbox.orderBy('seq').limit(SYNC_PUSH_MAX_BATCH).toArray();
      if (batch.length === 0) return;
      let results: SyncMutationResult[];
      try {
        results = await this.transport.push({
          clientId,
          mutations: batch.map(({ mutationId, entity, op, id, data, clientUpdatedAt }) => ({
            mutationId,
            entity,
            op,
            id,
            ...(data ? { data } : {}),
            clientUpdatedAt,
          })),
        });
      } catch (err) {
        await this.db.outbox.bulkUpdate(
          batch.map((b) => ({ key: b.seq!, changes: { attempts: b.attempts + 1 } })),
        );
        throw err;
      }
      const rejected = results.filter((r) => r.status === 'rejected');
      await this.db.transaction('rw', this.db.outbox, this.db.meta, async () => {
        const done = new Set(results.map((r) => r.mutationId));
        await this.db.outbox.bulkDelete(batch.filter((b) => done.has(b.mutationId)).map((b) => b.seq!));
        if (rejected.length > 0) {
          const prev = ((await this.db.meta.get(REJECTED_KEY))?.value as unknown[]) ?? [];
          await this.db.meta.put({ key: REJECTED_KEY, value: [...prev, ...rejected].slice(-50) });
        }
      });
      if (rejected.length > 0) this.update({ rejected: this.state.rejected + rejected.length });
    }
  }

  private async pullAll() {
    for (;;) {
      const cursor = ((await this.db.meta.get(CURSOR_KEY))?.value as number | undefined) ?? 0;
      const page = await this.transport.pull(cursor);
      const known = new Set(this.db.entityNames());
      const stores = this.db.entityNames().map((n) => this.db.entityTable(n));
      await safeWrite(() =>
        this.db.transaction('rw', [...stores, this.db.outbox, this.db.meta], async () => {
          for (const change of page.changes) {
            if (!known.has(change.entity)) continue;
            // A local edit made after the push wins locally until it is pushed and comes back.
            const pending = await this.db.outbox.where('[entity+id]').equals([change.entity, change.id]).count();
            if (pending > 0) continue;
            const table = this.db.entityTable(change.entity);
            if (change.deleted) await table.delete(change.id);
            else await table.put({ ...change.data, id: change.id, serverVersion: change.serverVersion });
          }
          await this.db.meta.put({ key: CURSOR_KEY, value: page.cursor });
        }),
      );
      if (!page.hasMore) return;
    }
  }

  private async clientId(): Promise<string> {
    const existing = (await this.db.meta.get(CLIENT_ID_KEY))?.value as string | undefined;
    if (existing) return existing;
    const id = uuidv7();
    await this.db.meta.put({ key: CLIENT_ID_KEY, value: id });
    return id;
  }

  private async refreshPending() {
    this.update({ pending: await this.db.outbox.count() });
  }

  private update(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }
}
