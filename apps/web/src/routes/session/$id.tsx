import { useEffect, useMemo, useState } from 'react';
import { PageSpinner } from '@/components/Spinner';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Bell, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { useExercises } from '@/features/catalog/exercises';
import { ExercisePicker } from '@/features/training/ExercisePicker';
import { RestBar, useRest } from '@/features/training/RestBar';
import { SessionExerciseCard } from '@/features/training/SessionExerciseCard';
import { SubstituteSheet } from '@/features/training/SubstituteSheet';
import { enableRestAlerts, hasPushSubscription, pushSupported, useWakeLock } from '@/features/training/device';
import { formatClock } from '@/features/training/rest-timer';
import {
  addSessionExercise,
  discardSession,
  finishSession,
  swapSessionExercise,
  useRoutine,
  useSessionDetail,
  type LocalSessionExercise,
} from '@/features/training/repo';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { useUser } from '@/lib/auth-context';
import { useLocations, useProfile } from '@/lib/repos';
import { useNow } from '@/lib/use-now';

export const Route = createFileRoute('/session/$id')({ component: SessionPage });

function SessionPage() {
  const { id } = Route.useParams();
  const user = useUser();
  const detail = useSessionDetail(user.id, id);
  const profile = useProfile(user.id);
  const exercisesRaw = useExercises(user.id);
  const exercises = useMemo(() => exercisesRaw ?? [], [exercisesRaw]);
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const locations = useLocations(user.id) ?? [];
  const routine = useRoutine(user.id, detail?.session.routineId ?? '__none__');
  const rest = useRest(id);
  const navigate = useNavigate();
  const [picking, setPicking] = useState(false);
  const [swapping, setSwapping] = useState<LocalSessionExercise | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [effort, setEffort] = useState('');
  const [notes, setNotes] = useState('');
  const [alerts, setAlerts] = useState<'unknown' | 'on' | 'off' | 'denied'>('unknown');

  const inProgress = detail?.session.status === 'in_progress';
  useWakeLock(inProgress);
  const now = useNow(1000, inProgress);
  useEffect(() => {
    void hasPushSubscription().then((on) => setAlerts(on ? 'on' : 'off'));
  }, []);

  if (detail === undefined || profile === undefined) return <PageSpinner />;
  if (detail === null) return <p>{t('session.notFound')}</p>;
  const { session } = detail;
  const units = profile?.units ?? 'kg';
  const location = locations.find((l) => l.id === session.locationId) ?? locations.find((l) => l.isDefault) ?? null;

  if (session.status !== 'in_progress') return <Summary detail={detail} units={units} onDone={() => void navigate({ to: '/' })} />;

  const targets = new Map((routine?.items ?? []).map((i) => [i.exerciseId, i]));
  const elapsed = Math.floor((now - Date.parse(session.startedAt)) / 1000);

  return (
    <div className="flex flex-col gap-4 pb-16">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">{session.name}</h1>
          <p className="text-sm tabular-nums text-muted-foreground">{t('train.elapsed', { time: formatClock(elapsed) })}</p>
        </div>
        <Button variant="outline" onClick={() => setFinishing(true)}>{t('session.finish')}</Button>
      </header>

      {pushSupported() && alerts === 'off' && (
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const r = await enableRestAlerts();
            setAlerts(r === 'granted' ? 'on' : r === 'denied' ? 'denied' : 'off');
          }}
        >
          <Bell className="size-4" aria-hidden />
          {t('session.enableAlerts')}
        </Button>
      )}
      {alerts === 'denied' && <p className="text-sm text-muted-foreground">{t('session.alertsDenied')}</p>}

      {detail.exercises.length === 0 && <p className="text-muted-foreground">{t('session.emptySession')}</p>}
      {detail.exercises.map((se) => (
        <SessionExerciseCard
          key={se.id}
          userId={user.id}
          sessionId={session.id}
          se={se}
          exercise={byId.get(se.exerciseId)}
          target={targets.get(se.exerciseId)}
          units={units}
          onLogged={(secs) => rest.start(secs)}
          onSwap={() => setSwapping(se)}
        />
      ))}

      <Button variant="outline" onClick={() => setPicking(true)}>
        <Plus className="size-4" aria-hidden />
        {t('session.addExercise')}
      </Button>

      {finishing && (
        <section aria-label={t('session.finishTitle')} className="flex flex-col gap-3 rounded-lg border border-primary p-4">
          <h2 className="text-lg font-semibold">{t('session.finishTitle')}</h2>
          <SelectField label={t('session.effort')} value={effort} onChange={(e) => setEffort(e.target.value)}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </SelectField>
          <TextField label={t('session.notes')} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                rest.clear();
                await finishSession(user.id, session, { perceivedEffort: effort ? Number(effort) : null, notes: notes.trim() || null });
              }}
            >
              {t('session.confirmFinish')}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                rest.clear();
                await discardSession(user.id, session);
                await navigate({ to: '/' });
              }}
            >
              {t('session.discard')}
            </Button>
          </div>
        </section>
      )}

      <RestBar rest={rest.rest} onAdd={() => rest.add(15)} onSubtract={() => rest.add(-15)} onSkip={() => rest.clear()} />

      {picking && (
        <ExercisePicker
          userId={user.id}
          location={location}
          onClose={() => setPicking(false)}
          onPick={async (ex) => {
            await addSessionExercise(user.id, session.id, ex.id);
            setPicking(false);
          }}
        />
      )}
      {swapping && (
        <SubstituteSheet
          target={byId.get(swapping.exerciseId)}
          candidates={exercises}
          exclude={detail.exercises.map((e) => e.exerciseId)}
          location={location}
          onClose={() => setSwapping(null)}
          onPick={async (exerciseId) => {
            await swapSessionExercise(user.id, swapping, exerciseId);
            setSwapping(null);
          }}
        />
      )}
    </div>
  );
}

function Summary({
  detail,
  units,
  onDone,
}: {
  detail: NonNullable<ReturnType<typeof useSessionDetail>>;
  units: 'kg' | 'lb';
  onDone: () => void;
}) {
  const { session, exercises } = detail;
  const sets = exercises.flatMap((e) => e.sets);
  const volumeKg = sets.reduce((sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
  const minutes = session.endedAt ? Math.max(1, Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000)) : 0;
  const volume = units === 'kg' ? Math.round(volumeKg) : Math.round(volumeKg / 0.45359237);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">{session.status === 'completed' ? t('session.summaryTitle') : t('session.discardedTitle')}</h1>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-xs text-muted-foreground">{t('session.duration')}</dt>
          <dd className="text-lg font-semibold">{t('session.minutes', { count: minutes })}</dd>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-xs text-muted-foreground">{t('session.totalSets')}</dt>
          <dd className="text-lg font-semibold">{sets.length}</dd>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-xs text-muted-foreground">{t('session.volume')}</dt>
          <dd className="text-lg font-semibold">
            {formatNumber(volume, 0)} {units}
          </dd>
        </div>
      </dl>
      <Button size="lg" onClick={onDone}>
        {t('session.done')}
      </Button>
    </section>
  );
}
