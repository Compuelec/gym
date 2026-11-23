import { useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { InstallPrompt } from '@/features/install/InstallPrompt';
import { formatClock } from '@/features/training/rest-timer';
import { discardSession, finishSession, isStale, startSession, useActiveSession, useRoutines } from '@/features/training/repo';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';
import { useNow } from '@/lib/use-now';

export const Route = createFileRoute('/')({ component: TrainPage });

function TrainPage() {
  const user = useUser();
  const active = useActiveSession(user.id);
  const routines = useRoutines(user.id) ?? [];
  const locations = useLocations(user.id) ?? [];
  const navigate = useNavigate();
  const [locationId, setLocationId] = useState('');
  const now = useNow(1000);
  const where = locationId || locations.find((l) => l.isDefault)?.id || null;

  async function start(routineId: string | null) {
    const routine = routines.find((r) => r.id === routineId) ?? null;
    const id = await startSession(user.id, {
      name: routine?.name ?? t('train.freeName'),
      routine,
      locationId: routine?.locationId ?? where,
    });
    await navigate({ to: '/session/$id', params: { id } });
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t('app.greeting', { name: user.name.split(' ')[0] ?? user.name })}</h1>
        <p className="text-muted-foreground">{t('app.tagline')}</p>
      </header>

      {active && (
        <article className="flex flex-col gap-3 rounded-lg border border-primary p-4">
          <div>
            <h2 className="font-semibold">{t('train.inProgress')}</h2>
            <p className="text-sm text-muted-foreground">
              {active.name} · {t('train.elapsed', { time: formatClock(Math.floor((now - Date.parse(active.startedAt)) / 1000)) })}
            </p>
          </div>
          {isStale(active, now) && (
            <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <p>{t('train.stale')}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void finishSession(user.id, active)}>
                  {t('train.finishIt')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void discardSession(user.id, active)}>
                  {t('train.discardIt')}
                </Button>
              </div>
            </div>
          )}
          <Link to="/session/$id" params={{ id: active.id }}>
            <Button className="w-full">{t('train.continue')}</Button>
          </Link>
        </article>
      )}

      {!active && (
        <>
          {locations.length > 1 && (
            <SelectField label={t('train.where')} value={where ?? ''} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
          )}
          <ul className="flex flex-col gap-2">
            {routines.map((r) => (
              <li key={r.id}>
                <Button className="w-full justify-start" size="lg" variant="outline" onClick={() => void start(r.id)}>
                  <Play className="size-4" aria-hidden />
                  {t('train.startRoutine', { name: r.name })}
                </Button>
              </li>
            ))}
          </ul>
          {routines.length === 0 && <p className="text-sm text-muted-foreground">{t('train.noRoutines')}</p>}
          <Button size="lg" onClick={() => void start(null)}>
            <Play className="size-4" aria-hidden />
            {t('train.free')}
          </Button>
        </>
      )}

      <InstallPrompt />
    </section>
  );
}
