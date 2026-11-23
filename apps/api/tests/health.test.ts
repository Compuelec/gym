import { afterAll, describe, expect, it } from 'vitest';
import { createTestApp, createTestAppWithDb, createTestDb } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);

afterAll(() => pool.end());

describe('health', () => {
  it('GET /api/health/live responds ok without touching the database', async () => {
    const res = await app.request('/api/health/live');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/health responds ok when the database answers', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });

  it('GET /api/health responds 503 when the database is down', async () => {
    const broken = createTestDb();
    await broken.pool.end();
    const res = await createTestApp(broken.db).request('/api/health');
    expect(res.status).toBe(503);
  });

  it('does not serve routes outside /api', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(404);
  });
});
