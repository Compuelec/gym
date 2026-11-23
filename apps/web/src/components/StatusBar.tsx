import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { t, tn } from '@/i18n';
import { useOnline, useSyncState } from '@/lib/sync-client';

/** Thin bar that tells the user whether their changes are safe on the server. */
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
  if (sync.status === 'syncing' && sync.pending > 0) {
    return (
      <div role="status" className="flex items-center gap-2 bg-muted px-4 py-2 text-sm">
        <RefreshCw className="size-4 animate-spin" aria-hidden />
        <span>{t('status.syncing')}</span>
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
  if (sync.status === 'error') {
    return (
      <div role="status" className="flex items-center gap-2 bg-muted px-4 py-2 text-sm">
        <TriangleAlert className="size-4" aria-hidden />
        <span>{t('status.error')}</span>
      </div>
    );
  }
  return null;
}
