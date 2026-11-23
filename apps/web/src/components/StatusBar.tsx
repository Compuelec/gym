import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { t, tn } from '@/i18n';
import { useOnline, useSyncState } from '@/lib/sync-client';

/**
 * Tells the user whether their changes are safe on the server. Persistent states (offline,
 * sign-in needed, rejected changes) are a banner in the flow; transient states (syncing, retrying)
 * are a floating pill, so content never jumps under the user's finger.
 */
export function StatusBar({ userId }: { userId: string }) {
  const online = useOnline();
  const sync = useSyncState(userId);

  if (!online) {
    return (
      <div role="status" className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900">
        <CloudOff className="size-4" aria-hidden />
        <span>{t('status.offline')}</span>
        {sync.pending > 0 && <span className="ml-auto">{tn('status.pending', sync.pending)}</span>}
      </div>
    );
  }
  if (sync.status === 'auth_required') {
    return (
      <div role="status" className="flex items-center gap-2 bg-amber-100 px-4 py-2 text-sm text-amber-900">
        <TriangleAlert className="size-4" aria-hidden />
        <span>{t('status.authRequired')}</span>
      </div>
    );
  }
  if (sync.rejected > 0) {
    return (
      <div role="status" className="flex items-center gap-2 bg-red-50 px-4 py-2 text-sm text-red-800">
        <TriangleAlert className="size-4" aria-hidden />
        <span>{t('status.rejected')}</span>
      </div>
    );
  }
  const transient =
    sync.status === 'syncing' && sync.pending > 0 ? (
      <>
        <RefreshCw className="size-3.5 animate-spin" aria-hidden />
        {t('status.syncing')}
      </>
    ) : sync.status === 'error' ? (
      <>
        <TriangleAlert className="size-3.5" aria-hidden />
        {t('status.error')}
      </>
    ) : null;
  if (!transient) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed top-2 right-2 z-50 flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1 text-xs shadow ring-1 ring-border"
    >
      {transient}
    </div>
  );
}
