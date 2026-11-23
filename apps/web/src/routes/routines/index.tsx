import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  deleteRoutine,
  duplicateRoutine,
  startSession,
  useRoutines,
} from '@/features/training/repo';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';

export const Route = createFileRoute('/routines/')({ component: RoutinesPage });

function RoutinesPage() {
  const user = useUser();
  const routines = useRoutines(user.id);
  const locations = new Map((useLocations(user.id) ?? []).map((l) => [l.id, l.name]));
  const navigate = useNavigate();
  if (!routines) return null;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('routines.title')}</h1>
        <Link to="/routines/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Plus className="size-4" aria-hidden />
          {t('routines.new')}
        </Link>
      </header>
      {routines.length === 0 && <p className="text-muted-foreground">{t('routines.empty')}</p>}
      <ul className="flex flex-col gap-3">
        {routines.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <div>
              <h2 className="font-semibold">{r.name}</h2>
              <p className="text-sm text-muted-foreground">
                {t('routines.exercises', { count: r.items.length })}
                {r.locationId && locations.get(r.locationId)
                  ? ` · ${locations.get(r.locationId)}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  const id = await startSession(user.id, {
                    name: r.name,
                    routine: r,
                    locationId: r.locationId,
                  });
                  await navigate({ to: '/session/$id', params: { id } });
                }}
              >
                {t('routines.start')}
              </Button>
              <Link
                to="/routines/$id/edit"
                params={{ id: r.id }}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                {t('routines.edit')}
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void duplicateRoutine(user.id, r, t('routines.copySuffix'))}
              >
                {t('routines.duplicate')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void deleteRoutine(user.id, r.id)}>
                {t('routines.delete')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
