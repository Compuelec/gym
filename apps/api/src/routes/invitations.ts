import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from '../db/client';
import type { Env } from '../env';
import { apiError } from '../lib/errors';
import { checkInvitation, inviteCookieHeader, signInviteCookie } from '../lib/invitations';

const CodeSchema = z.object({ code: z.string().min(4).max(40) });

/** Public: lets the sign-up screen validate a code, and arms Google sign-up with it. */
export function invitationRoutes(db: Database, config: Env) {
  return new Hono()
    .post('/check', async (c) => {
      const body = CodeSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      return c.json(await checkInvitation(db, body.data.code));
    })
    .post('/claim', async (c) => {
      const body = CodeSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const check = await checkInvitation(db, body.data.code);
      if (!check.valid) return apiError(c, 403, 'FORBIDDEN', 'La invitación no es válida o ya se usó.');
      const secure = config.BETTER_AUTH_URL.startsWith('https://');
      c.header('set-cookie', inviteCookieHeader(signInviteCookie(body.data.code, config.BETTER_AUTH_SECRET), secure));
      return c.json({ ok: true });
    });
}
