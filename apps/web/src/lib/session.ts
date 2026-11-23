import { useEffect } from 'react';
import { authClient } from './auth-client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: SessionUser; offline: boolean };

const CACHE_KEY = 'gym.lastUser';

function readCache(): SessionUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function writeCache(user: SessionUser | null) {
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the session still works online.
  }
}

/**
 * Session that survives the gym's missing signal: when the server cannot be reached, the last
 * signed-in user keeps using the app offline. Only an explicit "no session" answer from the
 * server signs the user out.
 */
export function useAuth(): AuthState {
  const { data, isPending, error } = authClient.useSession();
  const user = data?.user as SessionUser | undefined;

  useEffect(() => {
    if (user) writeCache({ id: user.id, email: user.email, name: user.name, role: user.role });
    else if (!isPending && !error) writeCache(null);
  }, [user, isPending, error]);

  if (user) return { status: 'signedIn', user, offline: false };
  if (isPending) {
    const cached = readCache();
    return cached && !navigator.onLine ? { status: 'signedIn', user: cached, offline: true } : { status: 'loading' };
  }
  if (error) {
    const cached = readCache();
    return cached ? { status: 'signedIn', user: cached, offline: true } : { status: 'signedOut' };
  }
  return { status: 'signedOut' };
}

export function clearSessionCache() {
  writeCache(null);
}
