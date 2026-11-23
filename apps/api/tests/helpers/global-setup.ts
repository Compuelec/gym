import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const TEST_URL = process.env.TEST_DATABASE_URL ?? 'postgres://gym:gym@localhost:55432/gym_test';
const COMPOSE = fileURLToPath(new URL('../../../../infra/docker-compose.test.yml', import.meta.url));

async function canConnect() {
  const client = new pg.Client({ connectionString: TEST_URL });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/** Starts the disposable test database if needed and recreates the schema from migrations. */
export default async function setup() {
  if (!(await canConnect())) {
    execSync(`docker compose -f "${COMPOSE}" up -d --wait postgres`, { stdio: 'inherit' });
  }
  const pool = new pg.Pool({ connectionString: TEST_URL });
  await pool.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
  await pool.end();
}
