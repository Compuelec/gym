import { createFileRoute } from '@tanstack/react-router';
import { useCredits } from '@/features/catalog/exercises';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';

export const Route = createFileRoute('/credits')({ component: CreditsPage });

function CreditsPage() {
  const user = useUser();
  const credits = useCredits(user.id) ?? [];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{t('exercises.creditsTitle')}</h1>
      <p className="text-muted-foreground">{t('exercises.creditsIntro')}</p>
      <ul className="flex flex-col gap-3">
        {credits.map((c) => (
          <li key={c.source} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-card text-sm">
            <a href={c.url} target="_blank" rel="noreferrer" className="font-medium underline">
              {c.source}
            </a>
            <span>
              {t('exercises.license')}: {c.license}
            </span>
            <span className="text-muted-foreground">{t('exercises.exercisesCount', { count: c.count })}</span>
            {c.authors.length > 0 && (
              <span className="text-muted-foreground">
                {t('exercises.authors')}: {c.authors.join(', ')}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
