import { useEffect } from 'react';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { requestPersistentStorage } from '@/db/persistence';
import { useSession } from '@/lib/auth-client';
import { getSyncEngine } from '@/lib/sync-client';

export const Route = createRootRoute({ component: Root });

function Root() {
  const { data: session } = useSession();

  // Sync only runs with a signed-in user; local data stays on the device either way.
  useEffect(() => {
    if (!session) return;
    void requestPersistentStorage();
    const engine = getSyncEngine();
    engine.start();
    return () => engine.stop();
  }, [session]);

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
