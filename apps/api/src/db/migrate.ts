import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb } from './client';

// The production image sets MIGRATIONS_DIR (the bundled file no longer sits next to drizzle/).
export const MIGRATIONS_FOLDER = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations() {
  await migrate(getDb(), { migrationsFolder: MIGRATIONS_FOLDER });
}

// CLI: `pnpm db:migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => closeDb())
    .then(() => console.log('migrations applied'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
