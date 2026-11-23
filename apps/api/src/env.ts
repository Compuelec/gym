import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  // Header carrying the real client IP (Cloudflare Tunnel sets cf-connecting-ip).
  AUTH_IP_HEADER: z.string().default('cf-connecting-ip'),
  // Login/sign-up rate limiting. On by default in production; only test stacks turn it off.
  AUTH_RATE_LIMIT: z.enum(['on', 'off']).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Validated environment, parsed once. Throws with a readable message when misconfigured. */
export function env(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(`Invalid environment configuration: ${fields}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Test helper: forget the cached environment after changing process.env. */
export function resetEnvCache() {
  cached = undefined;
}
