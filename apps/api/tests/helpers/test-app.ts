import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { createApp } from '../../src/app';
import type { Database } from '../../src/db/client';
import * as schema from '../../src/db/schema';
import { env } from '../../src/env';
import { SyncRegistry, type SyncEntityDef } from '../../src/lib/sync-registry';

export const ORIGIN = 'http://localhost:5173';

export function createTestDb() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  const db = drizzle(pool, { schema, casing: 'snake_case' }) as Database;
  return { db, pool };
}

export function createTestApp(db: Database, entities: SyncEntityDef[] = []) {
  return createApp({ db, config: env(), registry: new SyncRegistry(entities) });
}

type App = ReturnType<typeof createTestApp>;

let counter = 0;

/** Signs up a fresh user through the real auth endpoint and returns its session cookie. */
export async function signUp(app: App, overrides: { email?: string; password?: string } = {}) {
  counter += 1;
  const email = overrides.email ?? `user${Date.now()}${counter}@test.local`;
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: overrides.password ?? 'una-clave-segura', name: 'Prueba' }),
  });
  if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const body = (await res.json()) as { user: { id: string } };
  return { cookie, userId: body.user.id, email };
}

/** JSON request helper that sends the session cookie and the app Origin by default. */
export function call(
  app: App,
  path: string,
  init: { method?: string; cookie?: string; body?: unknown; origin?: string | null } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.origin !== null) headers.origin = init.origin ?? ORIGIN;
  return app.request(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
