import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Database } from '../../src/db/client';
import { syncColumns } from '../../src/db/columns';
import type { SyncEntityDef, SyncTable } from '../../src/lib/sync-registry';

/** Test-only entities that exercise the generic sync engine. */
export const testFolder = pgTable('test_folder', {
  ...syncColumns(),
  name: text('name').notNull(),
});

export const testNote = pgTable('test_note', {
  ...syncColumns(),
  folderId: uuid('folder_id'),
  title: text('title').notNull(),
  doneAt: timestamp('done_at', { withTimezone: true, mode: 'string' }),
});

export const testEntities: SyncEntityDef[] = [
  {
    name: 'testFolder',
    table: testFolder as unknown as SyncTable,
    schema: z.object({ name: z.string().min(1).max(40) }),
  },
  {
    name: 'testNote',
    table: testNote as unknown as SyncTable,
    schema: z.object({
      folderId: z.uuid().nullable().optional(),
      title: z.string().min(1).max(80),
      doneAt: z.iso.datetime({ offset: true }).nullable().optional(),
    }),
    references: (d) => (d.folderId ? [{ entity: 'testFolder', id: String(d.folderId) }] : []),
  },
];

const COMMON = `
  id uuid primary key,
  owner_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_version bigint not null default nextval('sync_version_seq')`;

export async function createTestEntityTables(db: Database) {
  await db.execute(sql.raw(`create table if not exists test_folder (${COMMON}, name text not null)`));
  await db.execute(
    sql.raw(`create table if not exists test_note (${COMMON}, folder_id uuid, title text not null, done_at timestamptz)`),
  );
}
