import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '../db/client';
import { user } from '../db/schema';
import { env } from '../env';
import { createInvitation } from '../lib/invitations';

/**
 * Admin commands (run in the API container or locally):
 *   admin invite [--email persona@correo.cl] [--days 7] [--count 1]
 *   admin promote <email>
 */
async function main(argv: string[]) {
  const [command, ...rest] = argv;
  const db = getDb();
  if (command === 'invite') {
    const email = flag(rest, '--email');
    const days = Number(flag(rest, '--days') ?? 7);
    const count = Math.min(Number(flag(rest, '--count') ?? 1), 500);
    for (let i = 0; i < count; i++) {
      const { code, expiresAt } = await createInvitation(db, { email, days });
      const url = `${env().BETTER_AUTH_URL}/signup?invite=${encodeURIComponent(code)}`;
      console.log(JSON.stringify({ code, url, expiresAt: expiresAt.toISOString(), email: email ?? null }));
    }
    return;
  }
  if (command === 'promote') {
    const email = rest[0]?.toLowerCase();
    if (!email) throw new Error('Uso: admin promote <email>');
    const rows = await db.update(user).set({ role: 'admin' }).where(eq(user.email, email)).returning({ id: user.id });
    if (rows.length === 0) throw new Error(`No existe un usuario con el correo ${email}`);
    console.log(`${email} ahora es administrador`);
    return;
  }
  throw new Error('Comandos: invite [--email x] [--days n] | promote <email>');
}

function flag(args: string[], name: string) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

main(process.argv.slice(2))
  .then(() => closeDb())
  .catch(async (err: Error) => {
    console.error(err.message);
    await closeDb();
    process.exit(1);
  });
