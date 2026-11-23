import { t } from '@/i18n';

export function FullPageSpinner() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center text-muted-foreground">
      {t('common.loading')}
    </div>
  );
}
