import { useEffect } from 'react';
import { Link, Navigate, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { FullPageSpinner } from '@/components/Spinner';
import { t } from '@/i18n';
import { getDB } from '@/db/database';
import { registerUpdateBlocker } from '@/lib/update-guard';
import { hasActiveSession } from '@/features/training/repo';
import { requestPersistentStorage } from '@/db/persistence';
import { ensureCatalog, scheduleImagePrecache } from '@/features/catalog/catalog-loader';
import { UserContext } from '@/lib/auth-context';
import { useProfile } from '@/lib/repos';
import { useAuth, type SessionUser } from '@/lib/session';
import { getSyncEngine, useSyncState } from '@/lib/sync-client';

export const Route = createRootRoute({ component: Root, notFoundComponent: NotFound });

function NotFound() {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold">{t('common.notFoundTitle')}</h1>
      <Link to="/" className="underline">
        {t('common.notFoundBack')}
      </Link>
    </section>
  );
}

const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password'];

function Root() {
  const auth = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isPublic = PUBLIC_PATHS.includes(path);

  if (auth.status === 'loading') return <FullPageSpinner />;
  if (auth.status === 'signedOut') {
    if (!isPublic) return <Navigate to="/login" replace />;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-8">
        <Outlet />
      </main>
    );
  }
  if (isPublic) return <Navigate to="/" replace />;
  return <SignedIn user={auth.user} path={path} />;
}

function SignedIn({ user, path }: { user: SessionUser; path: string }) {
  const sync = useSyncState(user.id);
  const profile = useProfile(user.id);

  // Sync runs while signed in; local data stays usable without network.
  useEffect(() => {
    void requestPersistentStorage();
    const engine = getSyncEngine(user.id);
    engine.start();
    // Base catalog: download when new; the installed app also warms every image when idle.
    const db = getDB(user.id);
    void ensureCatalog(db).then(() => scheduleImagePrecache(db));
    // Never apply a new app version in the middle of a workout.
    // A forgotten session (older than 6 h) does not hold updates back forever.
    const unblock = registerUpdateBlocker(() => hasActiveSession(user.id));
    return () => {
      engine.stop();
      unblock();
    };
  }, [user.id]);

  // Wait for the first sync (or for being offline) before deciding the user is new.
  const firstSyncDone = sync.lastSyncedAt !== null || ['offline', 'error', 'auth_required'].includes(sync.status);
  if (profile === undefined || (!profile && !firstSyncDone)) return <FullPageSpinner />;
  if (!profile && path !== '/onboarding') return <Navigate to="/onboarding" replace />;
  if (profile && path === '/onboarding') return <Navigate to="/" replace />;

  return (
    <UserContext.Provider value={user}>
      {path === '/onboarding' ? (
        <main className="mx-auto w-full max-w-md px-4 py-6">
          <Outlet />
        </main>
      ) : (
        <AppShell userId={user.id}>
          <Outlet />
        </AppShell>
      )}
    </UserContext.Provider>
  );
}
