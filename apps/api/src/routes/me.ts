import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from '../db/client';
import type { Auth } from '../lib/auth';
import { apiError } from '../lib/errors';
import type { AppVariables } from '../lib/middleware';
import type { SyncRegistry } from '../lib/sync-registry';
import { ImportError, credentialHash, deleteUserData, exportUserData, importUserData, sessionCreatedAt } from '../lib/user-data';

const DeleteSchema = z.object({ confirm: z.literal('BORRAR'), password: z.string().optional() });
const RECENT_LOGIN_MS = 15 * 60 * 1000;

export function meRoutes(db: Database, registry: SyncRegistry, auth: Auth) {
  return new Hono<{ Variables: AppVariables; }>()
    .get('/export', async (c) => {
      const data = await exportUserData(db, registry, c.get('user').id);
      c.header('content-disposition', `attachment; filename="gym-${new Date().toISOString().slice(0, 10)}.json"`);
      c.header('cache-control', 'no-store');
      return c.json(data);
    })
    .post('/import', async (c) => {
      const body = await c.req.json().catch(() => null);
      try {
        return c.json(await importUserData(db, registry, c.get('user').id, body));
      } catch (err) {
        if (err instanceof ImportError) return apiError(c, 422, 'VALIDATION', err.message);
        throw err;
      }
    })
    .delete('/', async (c) => {
      const body = DeleteSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION', 'Escribe BORRAR para confirmar.');
      const userId = c.get('user').id;
      const hash = await credentialHash(db, userId);
      if (hash) {
        const ctx = await auth.$context;
        const ok = body.data.password ? await ctx.password.verify({ hash, password: body.data.password }) : false;
        if (!ok) return apiError(c, 403, 'FORBIDDEN', 'La contraseña no es correcta.');
      } else {
        // Accounts without password (Google): require a sign-in in the last 15 minutes.
        const session = await auth.api.getSession({ headers: c.req.raw.headers });
        const created = await sessionCreatedAt(db, session?.session.token);
        if (!created || Date.now() - created.getTime() > RECENT_LOGIN_MS)
          return apiError(c, 403, 'FORBIDDEN', 'Vuelve a iniciar sesión y repite la acción.');
      }
      await deleteUserData(db, registry, userId);
      return c.json({ deleted: true });
    });
}
