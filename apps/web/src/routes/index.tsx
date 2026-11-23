import { createFileRoute } from '@tanstack/react-router';
import { InstallPrompt } from '@/features/install/InstallPrompt';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';

export const Route = createFileRoute('/')({ component: Home });

function Home() {
  const user = useUser();
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('app.greeting', { name: user.name.split(' ')[0] ?? user.name })}</h1>
        <p className="text-muted-foreground">{t('app.tagline')}</p>
      </header>
      <InstallPrompt />
    </section>
  );
}
