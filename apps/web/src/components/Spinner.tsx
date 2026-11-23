import { t } from '@/i18n';

export function FullPageSpinner() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
      {t('common.loading')}
    </div>
  );
}

/** Inside a screen while its local data loads (instead of an empty page). */
export function PageSpinner() {
  return (
    <div role="status" className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
      {t('common.loading')}
    </div>
  );
}
