import { createFileRoute } from '@tanstack/react-router';
import { t } from '@/i18n';

export const Route = createFileRoute('/progress')({ component: ProgressPage });

function ProgressPage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t('nav.progress')}</h1>
      <p className="text-muted-foreground">{t('common.comingSoon')}</p>
    </section>
  );
}
