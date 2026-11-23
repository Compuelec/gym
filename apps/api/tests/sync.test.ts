import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidv7, type SyncPullResponse, type SyncPushResponse } from '@gym/shared';
import { call, createTestApp, createTestDb, signUp } from './helpers/test-app';
import { createTestEntityTables, testEntities } from './helpers/test-entity';

const { db, pool } = createTestDb();
const app = createTestApp(db, testEntities);

beforeAll(() => createTestEntityTables(db));
afterAll(() => pool.end());

const now = () => new Date().toISOString();

function upsert(entity: string, id: string, data: Record<string, unknown>, mutationId = uuidv7()) {
  return { mutationId, entity, op: 'upsert' as const, id, data, clientUpdatedAt: now() };
}
function del(entity: string, id: string) {
  return { mutationId: uuidv7(), entity, op: 'delete' as const, id, clientUpdatedAt: now() };
}

async function push(cookie: string, mutations: unknown[]) {
  const res = await call(app, '/api/sync/push', {
    method: 'POST',
    cookie,
    body: { clientId: uuidv7(), mutations },
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as SyncPushResponse).results;
}

async function pull(cookie: string, cursor = 0, limit?: number) {
  const qs = `cursor=${cursor}${limit ? `&limit=${limit}` : ''}`;
  const res = await call(app, `/api/sync/pull?${qs}`, { cookie });
  expect(res.status).toBe(200);
  return (await res.json()) as SyncPullResponse;
}

describe('POST /api/sync/push', () => {
  it('applies an upsert and returns its server version', async () => {
    const { cookie } = await signUp(app);
    const [r] = await push(cookie, [upsert('testNote', uuidv7(), { title: 'Sentadillas' })]);
    expect(r?.status).toBe('applied');
    expect(r?.status === 'applied' && r.serverVersion).toBeGreaterThan(0);
  });

  it('is idempotent: a repeated mutationId returns duplicate with the same version', async () => {
    const { cookie } = await signUp(app);
    const m = upsert('testNote', uuidv7(), { title: 'Uno' });
    const [first] = await push(cookie, [m]);
    const [second] = await push(cookie, [m]);
    expect(second?.status).toBe('duplicate');
    expect(second?.status === 'duplicate' && second.serverVersion).toBe(
      first?.status === 'applied' && first.serverVersion,
    );
    const page = await pull(cookie);
    expect(page.changes).toHaveLength(1);
  });

  it("rejects another user's record as NOT_FOUND and leaves it unchanged", async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    const id = uuidv7();
    await push(a.cookie, [upsert('testNote', id, { title: 'De A' })]);
    const [r] = await push(b.cookie, [upsert('testNote', id, { title: 'Hackeado' })]);
    expect(r?.status).toBe('rejected');
    expect(r?.status === 'rejected' && r.error.code).toBe('NOT_FOUND');
    const [d] = await push(b.cookie, [del('testNote', id)]);
    expect(d?.status === 'rejected' && d.error.code).toBe('NOT_FOUND');
    const pageA = await pull(a.cookie);
    expect(pageA.changes[0]?.data.title).toBe('De A');
    expect(pageA.changes[0]?.deleted).toBe(false);
    expect((await pull(b.cookie)).changes).toHaveLength(0);
  });

  it('rejects invalid data with VALIDATION in Spanish and applies the rest of the batch', async () => {
    const { cookie } = await signUp(app);
    const results = await push(cookie, [
      upsert('testNote', uuidv7(), { title: '' }),
      upsert('testNote', uuidv7(), { title: 'Válida' }),
    ]);
    expect(results[0]?.status).toBe('rejected');
    expect(results[0]?.status === 'rejected' && results[0].error.message).toMatch(/no son válidos/);
    expect(results[1]?.status).toBe('applied');
  });

  it('ignores server-managed fields sent by the client', async () => {
    const { cookie, userId } = await signUp(app);
    const id = uuidv7();
    await push(cookie, [upsert('testNote', id, { title: 'X', ownerId: 'someone-else', serverVersion: 1 })]);
    const page = await pull(cookie);
    expect(page.changes.find((c) => c.id === id)).toBeDefined();
    expect(userId).toBeTruthy();
  });

  it('rejects unknown entities', async () => {
    const { cookie } = await signUp(app);
    const [r] = await push(cookie, [upsert('nope', uuidv7(), {})]);
    expect(r?.status === 'rejected' && r.error.code).toBe('UNKNOWN_ENTITY');
  });

  it('accepts references created earlier in the same batch, rejects missing or foreign ones', async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    const folder = uuidv7();
    const ok = await push(a.cookie, [
      upsert('testFolder', folder, { name: 'Piernas' }),
      upsert('testNote', uuidv7(), { title: 'Nota', folderId: folder }),
    ]);
    expect(ok.map((r) => r.status)).toEqual(['applied', 'applied']);

    const [missing] = await push(a.cookie, [upsert('testNote', uuidv7(), { title: 'N', folderId: uuidv7() })]);
    expect(missing?.status === 'rejected' && missing.error.code).toBe('REFERENCE');

    const [foreign] = await push(b.cookie, [upsert('testNote', uuidv7(), { title: 'N', folderId: folder })]);
    expect(foreign?.status === 'rejected' && foreign.error.code).toBe('REFERENCE');
  });

  it('rejects a batch larger than 200 mutations', async () => {
    const { cookie } = await signUp(app);
    const mutations = Array.from({ length: 201 }, () => upsert('testNote', uuidv7(), { title: 'x' }));
    const res = await call(app, '/api/sync/push', {
      method: 'POST',
      cookie,
      body: { clientId: uuidv7(), mutations },
    });
    expect(res.status).toBe(400);
  });

  it('last write applied on the server wins for the same record', async () => {
    const { cookie } = await signUp(app);
    const id = uuidv7();
    await push(cookie, [upsert('testNote', id, { title: 'Desde el teléfono' })]);
    await push(cookie, [upsert('testNote', id, { title: 'Desde el computador' })]);
    const page = await pull(cookie);
    const notes = page.changes.filter((c) => c.id === id);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.data.title).toBe('Desde el computador');
  });
});

describe('GET /api/sync/pull', () => {
  it('returns only changes after the cursor, ordered and monotonic', async () => {
    const { cookie } = await signUp(app);
    await push(cookie, [upsert('testNote', uuidv7(), { title: '1' }), upsert('testFolder', uuidv7(), { name: 'F' })]);
    const first = await pull(cookie);
    expect(first.changes).toHaveLength(2);
    const versions = first.changes.map((c) => c.serverVersion);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);

    await push(cookie, [upsert('testNote', uuidv7(), { title: '2' })]);
    const second = await pull(cookie, first.cursor);
    expect(second.changes).toHaveLength(1);
    expect(second.changes[0]?.data.title).toBe('2');
    expect(second.cursor).toBeGreaterThan(first.cursor);

    const empty = await pull(cookie, second.cursor);
    expect(empty.changes).toHaveLength(0);
    expect(empty.cursor).toBe(second.cursor);
  });

  it('propagates deletes as tombstones', async () => {
    const { cookie } = await signUp(app);
    const id = uuidv7();
    await push(cookie, [upsert('testNote', id, { title: 'Borrar' })]);
    const before = await pull(cookie);
    await push(cookie, [del('testNote', id)]);
    const after = await pull(cookie, before.cursor);
    expect(after.changes).toEqual([
      expect.objectContaining({ entity: 'testNote', id, deleted: true }),
    ]);
  });

  it('pages with limit and hasMore', async () => {
    const { cookie } = await signUp(app);
    await push(cookie, Array.from({ length: 5 }, (_, i) => upsert('testNote', uuidv7(), { title: `n${i}` })));
    const p1 = await pull(cookie, 0, 3);
    expect(p1.changes).toHaveLength(3);
    expect(p1.hasMore).toBe(true);
    const p2 = await pull(cookie, p1.cursor, 3);
    expect(p2.changes).toHaveLength(2);
    expect(p2.hasMore).toBe(false);
  });

  it('never returns other users data and does not expose ownerId', async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    await push(a.cookie, [upsert('testNote', uuidv7(), { title: 'Privado' })]);
    expect((await pull(b.cookie)).changes).toHaveLength(0);
    const page = await pull(a.cookie);
    expect(page.changes[0]?.data).not.toHaveProperty('ownerId');
  });

  it('serializes concurrent pushes of one owner so a pull never skips a change', async () => {
    const { cookie } = await signUp(app);
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => push(cookie, [upsert('testNote', uuidv7(), { title: `c${i}` })])),
    );
    const page = await pull(cookie);
    expect(page.changes).toHaveLength(8);
  });
});
