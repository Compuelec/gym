import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { env } from '../env';

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let db: Database | undefined;

export function getPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: env().DATABASE_URL, max: 10 });
  return pool;
}

export function getDb(): Database {
  db ??= drizzle(getPool(), { schema, casing: 'snake_case' });
  return db;
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
  db = undefined;
}
