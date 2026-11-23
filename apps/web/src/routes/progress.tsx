import { useMemo, useState } from 'react';
import { PageSpinner } from '@/components/Spinner';
import { Link, createFileRoute } from '@tanstack/react-router';
import { exerciseSeries, volumeByGroup, weeklyFrequency, weeklyStreak } from '@gym/engine';
import { kgToDisplay } from '@gym/shared';
import { SelectField } from '@/components/ui/field';
import { useExercises } from '@/features/catalog/exercises';
import { BarSeries, LineSeries } from '@/features/progress/Charts';
import { useCompletedSessions } from '@/features/progress/data';
import { t, tn } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';
import { useProfile } from '@/lib/repos';
import { useNow } from '@/lib/use-now';

export const Route = createFileRoute('/progress')({ component: ProgressPage });

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function ProgressPage() {
  const user = useUser();
  const sessions = useCompletedSessions(user.id);
  const exercisesRaw = useExercises(user.id);
  const profile = useProfile(user.id);
  const units = profile?.units ?? 'kg';
  const byId = useMemo(() => new Map((exercisesRaw ?? []).map((e) => [e.id, e])), [exercisesRaw]);
  const [exerciseId, setExerciseId] = useState('');
  const now = useNow(60_000);

  const stats = useMemo(() => {
    if (!sessions) return null;
    const dates = sessions.map((s) => s.startedAt);
    const sets = sessions.flatMap((s) =>
      s.exercises.flatMap((se) =>
        se.sets.map((st) => ({
          ...st,
          primaryMuscles: byId.get(se.exerciseId)?.primaryMuscles ?? [],
          secondaryMuscles: byId.get(se.exerciseId)?.secondaryMuscles ?? [],
        })),
      ),
    );
    const done = [...new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
    return {
      frequency: weeklyFrequency(dates, now, 8),
      streak: weeklyStreak(dates, now),
      volume: volumeByGroup(sets, now),
      exercisesDone: done.sort((a, b) => (byId.get(a)?.nameEs ?? a).localeCompare(byId.get(b)?.nameEs ?? b, 'es')),
    };
  }, [sessions, byId, now]);

  if (!sessions || !stats) return <PageSpinner />;
  const selected = exerciseId || stats.exercisesDone[0] || '';
  const series = exerciseSeries(
    sessions.flatMap((s) => s.exercises.filter((e) => e.exerciseId === selected).map((e) => ({ date: s.startedAt, sets: e.sets }))),
  );
  const measure = byId.get(selected)?.measure;
  const thisWeek = stats.frequency.at(-1)?.sessions ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('progress.title')}</h1>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-xs text-muted-foreground">{t('progress.streak')}</dt>
          <dd className="text-lg font-semibold">{stats.streak === 1 ? t('progress.streakOne') : t('progress.streakValue', { weeks: stats.streak })}</dd>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <dt className="text-xs text-muted-foreground">{t('progress.thisWeek')}</dt>
          <dd className="text-lg font-semibold">{tn('progress.sessionsValue', thisWeek)}</dd>
        </div>
      </dl>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground">{t('progress.noData')}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t('progress.frequency')}</h2>
            <BarSeries
              unit=""
              tableTitle={t('progress.frequency')}
              data={stats.frequency.map((w) => ({ label: shortDate(`${w.week}T00:00:00Z`), value: w.sessions }))}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t('progress.volume')}</h2>
            <BarSeries horizontal unit={t('progress.sets').toLowerCase()} tableTitle={t('progress.volume')} data={stats.volume.map((v) => ({ label: v.group, value: v.sets }))} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t('progress.byExercise')}</h2>
            <SelectField label={t('progress.chooseExercise')} value={selected} onChange={(e) => setExerciseId(e.target.value)}>
              {stats.exercisesDone.map((id) => (
                <option key={id} value={id}>
                  {byId.get(id)?.nameEs ?? id}
                </option>
              ))}
            </SelectField>
            {measure === 'weight_reps' ? (
              <>
                <h3 className="text-sm font-medium">{t('progress.est1rm')}</h3>
                <LineSeries
                  unit={units}
                  tableTitle={t('progress.est1rm')}
                  data={series.map((p) => ({ label: shortDate(p.date), value: kgToDisplay(p.est1rm || p.topWeight, units) }))}
                />
              </>
            ) : (
              <>
                <h3 className="text-sm font-medium">{t('progress.reps')}</h3>
                <LineSeries unit="" tableTitle={t('progress.reps')} data={series.map((p) => ({ label: shortDate(p.date), value: p.reps }))} />
              </>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{t('progress.history')}</h2>
            <ul className="flex flex-col divide-y divide-border">
              {sessions.slice(0, 20).map((s) => {
                const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0);
                return (
                  <li key={s.id}>
                    <Link to="/session/$id" params={{ id: s.id }} className="flex justify-between py-2">
                      <span>{s.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {shortDate(s.startedAt)} · {formatNumber(sets, 0)} {t('progress.sets').toLowerCase()}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <div className="flex flex-col gap-2 text-sm">
        <Link to="/measurements" className="underline">
          {t('progress.measurementsLink')}
        </Link>
        <Link to="/data" className="underline">
          {t('progress.dataLink')}
        </Link>
      </div>
    </div>
  );
}
