import { eq } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '../db/client';
import * as schema from '../db/schema';
import type { Env } from '../env';
import {
  INVITE_COOKIE,
  consumeInvitation,
  getCookie,
  linkInvitationToUser,
  readInviteCookie,
} from './invitations';
import { createMailer, resetPasswordMail, type Mailer } from './mailer';

const INVITE_REQUIRED_MESSAGE = 'Necesitas una invitación válida para crear una cuenta.';
export const ACCOUNT_DISABLED_MESSAGE = 'Tu cuenta está desactivada. Habla con quien administra la app.';

export function createAuth(db: Database, config: Env, mailer: Mailer = createMailer(config, db)) {
  const google =
    config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET } }
      : {};

  return betterAuth({
    baseURL: config.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(config.BETTER_AUTH_URL).origin],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await mailer.send(resetPasswordMail(user.email, user.name, url));
      },
    },
    databaseHooks: {
      session: {
        create: {
          // A deactivated account cannot sign in (email or Google).
          before: async (session) => {
            const [row] = await db.select({ disabledAt: schema.user.disabledAt }).from(schema.user).where(eq(schema.user.id, session.userId));
            if (row?.disabledAt) throw new APIError('FORBIDDEN', { message: ACCOUNT_DISABLED_MESSAGE, code: 'ACCOUNT_DISABLED' });
          },
        },
      },
      user: {
        create: {
          // Registration is by invitation only: email sign-up sends `inviteCode` in the body;
          // Google sign-up carries it in a signed cookie set by POST /api/invitations/claim.
          before: async (user, ctx) => {
            const body = (ctx?.body ?? {}) as { inviteCode?: unknown };
            const code =
              typeof body.inviteCode === 'string'
                ? body.inviteCode
                : readInviteCookie(getCookie(ctx?.headers ?? ctx?.request?.headers, INVITE_COOKIE), config.BETTER_AUTH_SECRET);
            if (!code || !(await consumeInvitation(db, code, user.email))) {
              throw new APIError('FORBIDDEN', { message: INVITE_REQUIRED_MESSAGE, code: 'INVITE_REQUIRED' });
            }
          },
          after: async (user) => {
            await linkInvitationToUser(db, user.email, user.id);
          },
        },
      },
    },
    socialProviders: google,
    user: {
      additionalFields: {
        // Never settable from sign-up or profile updates; only via the admin CLI.
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
        // Set only by an administrator (deactivation); read on every request.
        disabledAt: { type: 'date', required: false, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: (config.AUTH_RATE_LIMIT ?? (config.NODE_ENV === 'production' ? 'on' : 'off')) === 'on',
      window: 60,
      max: 30,
    },
    advanced: {
      database: { generateId: 'uuid' },
      ipAddress: { ipAddressHeaders: [config.AUTH_IP_HEADER] },
      useSecureCookies: config.BETTER_AUTH_URL.startsWith('https://'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type SessionUser = Auth['$Infer']['Session']['user'];
