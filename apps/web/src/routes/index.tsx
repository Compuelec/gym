import { createFileRoute } from '@tanstack/react-router';
import { t } from '@/i18n';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
      <p className="text-muted-foreground">{t('app.tagline')}</p>
    </section>
  );
}
