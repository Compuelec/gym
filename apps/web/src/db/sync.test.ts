import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7, type SyncMutationResult, type SyncPullResponse, type SyncPushRequest } from '@gym/shared';
import { GymDB } from './database';
import { backoffDelay, deleteRecord, saveRecord, SyncEngine, UnauthorizedError, type SyncTransport } from './sync';

let db: GymDB;
beforeEach(() => {
  db = new GymDB(`test-${uuidv7()}`, { note: 'id, serverVersion' });
});
afterEach(async () => {
  await db.delete();
});

/** In-memory fake server implementing the push/pull contract. */
function fakeServer() {
  const rows = new Map<string, { entity: string; data: Record<string, unknown>; v: number; deleted: boolean }>();
  let version = 0;
  const seen = new Map<string, number>();
  const pushes: SyncPushRequest[] = [];
  const transport: SyncTransport = {
    async push(body) {
      pushes.push(body);
      return body.mutations.map((m): SyncMutationResult => {
        if (seen.has(m.mutationId)) return { mutationId: m.mutationId, status: 'duplicate', serverVersion: seen.get(m.mutationId)! };
        if (m.entity === 'bad') return { mutationId: m.mutationId, status: 'rejected', error: { code: 'VALIDATION', message: 'x' } };
        version += 1;
        seen.set(m.mutationId, version);
        rows.set(`${m.entity}:${m.id}`, { entity: m.entity, data: m.data ?? {}, v: version, deleted: m.op === 'delete' });
        return { mutationId: m.mutationId, status: 'applied', serverVersion: version };
      });
    },
    async pull(cursor): Promise<SyncPullResponse> {
      const changes = [...rows.entries()]
        .filter(([, r]) => r.v > cursor)
        .sort(([, a], [, b]) => a.v - b.v)
        .map(([k, r]) => ({ entity: r.entity, id: k.split(':')[1]!, serverVersion: r.v, deleted: r.deleted, data: r.data }));
      return { changes, cursor: changes.at(-1)?.serverVersion ?? cursor, hasMore: false };
    },
  };
  return { transport, rows, pushes, bump: (entity: string, id: string, data: Record<string, unknown>) => {
    version += 1;
    rows.set(`${entity}:${id}`, { entity, data, v: version, deleted: false });
  } };
}

const online = { isOnline: () => true };

describe('saveRecord / deleteRecord', () => {
  it('writes the record and the outbox item in the same transaction', async () => {
    const id = uuidv7();
    await saveRecord(db, 'note', { id, title: 'Press banca' });
    expect(await db.entityTable('note').get(id)).toMatchObject({ title: 'Press banca' });
    const [item] = await db.outbox.toArray();
    expect(item).toMatchObject({ entity: 'note', op: 'upsert', id, data: { title: 'Press banca' } });
    expect(item?.data).not.toHaveProperty('id');
  });

  it('writes neither when the transaction fails', async () => {
    await expect(saveRecord(db, 'missing-store', { id: uuidv7() })).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
  });

  it('queues deletes', async () => {
    const id = uuidv7();
    await saveRecord(db, 'note', { id, title: 'x' });
    await deleteRecord(db, 'note', id);
    expect(await db.entityTable('note').get(id)).toBeUndefined();
    expect((await db.outbox.toArray()).map((o) => o.op)).toEqual(['upsert', 'delete']);
  });
});

describe('SyncEngine', () => {
  it('pushes the outbox, empties it, then pulls and saves the cursor', async () => {
    const server = fakeServer();
    const engine = new SyncEngine(db, server.transport, online);
    const id = uuidv7();
    await saveRecord(db, 'note', { id, title: 'Remo' });
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect(server.rows.get(`note:${id}`)?.data).toEqual({ title: 'Remo' });
    expect(await db.entityTable('note').get(id)).toMatchObject({ title: 'Remo', serverVersion: 1 });
    expect((await db.meta.get('syncCursor'))?.value).toBe(1);
    expect(engine.getState()).toMatchObject({ status: 'idle', pending: 0 });
  });

  it('applies remote changes and remote deletes', async () => {
    const server = fakeServer();
    const engine = new SyncEngine(db, server.transport, online);
    const a = uuidv7();
    server.bump('note', a, { title: 'Desde otro teléfono' });
    await engine.sync();
    expect(await db.entityTable('note').get(a)).toMatchObject({ title: 'Desde otro teléfono' });
    await server.transport.push({ clientId: uuidv7(), mutations: [{ mutationId: uuidv7(), entity: 'note', op: 'delete', id: a, clientUpdatedAt: new Date().toISOString() }] });
    await engine.sync();
    expect(await db.entityTable('note').get(a)).toBeUndefined();
  });

  it('keeps the outbox and reports offline when there is no network', async () => {
    const server = fakeServer();
    const engine = new SyncEngine(db, server.transport, { isOnline: () => false });
    await saveRecord(db, 'note', { id: uuidv7(), title: 'Sin señal' });
    await engine.sync();
    expect(server.pushes).toHaveLength(0);
    expect(engine.getState()).toMatchObject({ status: 'offline', pending: 1 });
  });

  it('never drops the outbox on 401 and asks to sign in again', async () => {
    const engine = new SyncEngine(db, { push: () => Promise.reject(new UnauthorizedError()), pull: vi.fn() }, online);
    await saveRecord(db, 'note', { id: uuidv7(), title: 'Pendiente' });
    await engine.sync();
    expect(await db.outbox.count()).toBe(1);
    expect(engine.getState().status).toBe('auth_required');
  });

  it('retries with exponential backoff after a network error, keeping the outbox', async () => {
    const server = fakeServer();
    const scheduled: Array<{ fn: () => void; ms: number }> = [];
    let fail = true;
    const transport: SyncTransport = {
      push: (b) => (fail ? Promise.reject(new TypeError('Failed to fetch')) : server.transport.push(b)),
      pull: (c) => server.transport.pull(c),
    };
    const engine = new SyncEngine(db, transport, {
      isOnline: () => true,
      schedule: (fn, ms) => {
        scheduled.push({ fn, ms });
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
    });
    await saveRecord(db, 'note', { id: uuidv7(), title: 'Reintento' });
    await engine.sync();
    expect(engine.getState().status).toBe('error');
    expect(await db.outbox.count()).toBe(1);
    expect((await db.outbox.toArray())[0]?.attempts).toBe(1);
    expect(scheduled[0]?.ms).toBe(backoffDelay(0));
    fail = false;
    scheduled[0]?.fn();
    await vi.waitFor(async () => expect(await db.outbox.count()).toBe(0));
    expect(engine.getState().status).toBe('idle');
  });

  it('removes rejected mutations from the outbox and records them', async () => {
    const engine = new SyncEngine(db, fakeServer().transport, online);
    await db.outbox.add({ mutationId: uuidv7(), entity: 'bad', op: 'upsert', id: uuidv7(), data: {}, clientUpdatedAt: new Date().toISOString(), attempts: 0 });
    await engine.sync();
    expect(await db.outbox.count()).toBe(0);
    expect(engine.getState().rejected).toBe(1);
    expect(((await db.meta.get('rejectedMutations'))?.value as unknown[]).length).toBe(1);
  });

  it('does not overwrite a local edit that is still pending', async () => {
    const server = fakeServer();
    const id = uuidv7();
    server.bump('note', id, { title: 'Servidor' });
    const transport: SyncTransport = { push: async () => { throw new TypeError('offline'); }, pull: server.transport.pull };
    await saveRecord(db, 'note', { id, title: 'Local' });
    // Pull alone (push failing) must not clobber the pending local edit.
    const engine = new SyncEngine(db, { push: async () => [], pull: transport.pull }, online);
    await db.outbox.toArray();
    await (engine as unknown as { pullAll: () => Promise<void> }).pullAll();
    expect(await db.entityTable('note').get(id)).toMatchObject({ title: 'Local' });
  });

  it('pushes in batches of at most 200', async () => {
    const server = fakeServer();
    const engine = new SyncEngine(db, server.transport, online);
    for (let i = 0; i < 205; i++) await db.outbox.add({ mutationId: uuidv7(), entity: 'note', op: 'upsert', id: uuidv7(), data: { title: `n${i}` }, clientUpdatedAt: new Date().toISOString(), attempts: 0 });
    await engine.sync();
    expect(server.pushes.map((p) => p.mutations.length)).toEqual([200, 5]);
  });

  it('backoff goes from 1 s up to a 5 min cap', () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(3)).toBe(8000);
    expect(backoffDelay(20)).toBe(300_000);
  });
});
