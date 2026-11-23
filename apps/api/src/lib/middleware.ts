import type { MiddlewareHandler } from 'hono';
import type { Auth, SessionUser } from './auth';
import { apiError } from './errors';

export type AppVariables = { user: SessionUser };

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF protection: state-changing requests must come from the app's own origin. Browsers always
 * send Origin on cross-site and same-origin POSTs; a missing or different Origin is rejected.
 */
export function originCheck(allowedOrigin: string): MiddlewareHandler {
  return async (c, next) => {
    if (STATE_CHANGING.has(c.req.method)) {
      const origin = c.req.header('origin');
      if (origin !== allowedOrigin) return apiError(c, 403, 'BAD_ORIGIN');
    }
    await next();
  };
}

export function requireSession(auth: Auth): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return apiError(c, 401, 'UNAUTHORIZED');
    c.set('user', session.user);
    await next();
  };
}

export function requireAdmin(): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    if (c.get('user')?.role !== 'admin') return apiError(c, 403, 'FORBIDDEN');
    await next();
  };
}
