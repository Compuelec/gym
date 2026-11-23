import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '../db/client';
import * as schema from '../db/schema';
import type { Env } from '../env';

export function createAuth(db: Database, config: Env) {
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
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: google,
    user: {
      additionalFields: {
        // Never settable from sign-up or profile updates; only via the admin CLI.
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
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
