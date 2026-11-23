import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { uuidv7, type SyncPullResponse } from '@gym/shared';
import { locations } from '../src/db/schema';
import { call, createTestAppWithDb, createTestDb, signUp } from './helpers/test-app';

const { db, pool } = createTestDb();
const app = createTestAppWithDb(db);
afterAll(() => pool.end());

const migration = readFileSync(new URL('../drizzle/0008_equipment_other_cleanup.sql', import.meta.url), 'utf8');

describe('equipment «other» cleanup (0008)', () => {
  it('removes the old vague «Otro equipo» from saved places and every device pulls the change', async () => {
    const { cookie, userId } = await signUp(app);
    const id = uuidv7();
    await db.insert(locations).values({ id, ownerId: userId, name: 'Casa', equipment: ['dumbbell', 'bench', 'other'], isDefault: true });
    const before = (await (await call(app, '/api/sync/pull', { cookie })).json()) as SyncPullResponse;

    await db.execute(sql.raw(migration));

    const after = (await (await call(app, `/api/sync/pull?cursor=${before.cursor}`, { cookie })).json()) as SyncPullResponse;
    const change = after.changes.find((c) => c.entity === 'location' && c.id === id);
    expect(change?.data).toMatchObject({ equipment: ['dumbbell', 'bench'] });
  });
});
