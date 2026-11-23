import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { Activity, Flame, MessageSquare, Play, Sparkles, Target } from 'lucide-react';
import { goalPlan, weeklyFrequency, weeklyStreak } from '@gym/engine';
import { useCompletedSessions, useMeasurements } from '@/features/progress/data';
import { useProfile } from '@/lib/repos';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SelectField } from '@/components/ui/field';
import { InstallPrompt } from '@/features/install/InstallPrompt';
import { formatClock } from '@/features/training/rest-timer';
import {
  discardSession,
  finishSession,
  isStale,
  startSession,
  useActiveSession,
  useRoutines,
} from '@/features/training/repo';
import { t, tn } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';
import { useNow } from '@/lib/use-now';

export const Route = createFileRoute('/')({ component: TrainPage });

function TrainPage() {
  const user = useUser();
  const coachStatus = useQuery({
    queryKey: ['coach-status'],
    queryFn: () => apiFetch('/coach/status') as Promise<{ available: boolean }>,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const active = useActiveSession(user.id);
  const routines = useRoutines(user.id) ?? [];
  const locations = useLocations(user.id) ?? [];
  const navigate = useNavigate();
  const [locationId, setLocationId] = useState('');
  const now = useNow(1000);
  const where = locationId || locations.find((l) => l.isDefault)?.id || null;
  const profile = useProfile(user.id);
  const sessions = useCompletedSessions(user.id) ?? [];
  const dates = sessions.map((x) => x.startedAt);
  const thisWeek = weeklyFrequency(dates, now, 1)[0]?.sessions ?? 0;
  const goal = profile?.daysPerWeek ?? 3;
  const weekPct = Math.min(100, Math.round((thisWeek / goal) * 100));
  const streak = weeklyStreak(dates, now);
  const measurements = useMeasurements(user.id) ?? [];
  const currentWeight = measurements.find((m) => m.weightKg != null)?.weightKg ?? profile?.bodyweightKg ?? null;

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
        <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
        <h1 className="text-[2rem] leading-none font-bold">
          {t('app.greeting', { name: user.name.split(' ')[0] ?? user.name })}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
          <div
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--primary) 0 ${weekPct}%, var(--muted) ${weekPct}% 100%)` }}
          >
            <span className="grid size-9 place-items-center rounded-full bg-card font-display text-sm font-bold">
              {thisWeek}/{goal}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('home.week')}</p>
            <p className="text-xs text-muted-foreground">{t('home.weekDone', { done: thisWeek, goal })}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Flame className="size-6" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t('home.streak')}</p>
            <p className="text-xs text-muted-foreground">{tn('home.streakWeeks', streak)}</p>
          </div>
        </div>
      </div>

      <Link to="/goal" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Target className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold">{t('goal.title')}</span>
          <span className="truncate text-xs text-muted-foreground">
            {profile?.targetWeightKg
              ? goalPlan({ weightKg: currentWeight, targetWeightKg: profile.targetWeightKg, targetDate: profile.targetDate, now }).message
              : t('home.goalEmpty')}
          </span>
        </span>
      </Link>

      {active && (
        <article className="flex flex-col gap-3 rounded-3xl border-2 border-primary bg-card p-4 shadow-card">
          <div>
            <h2 className="font-semibold">{t('train.inProgress')}</h2>
            <p className="text-sm text-muted-foreground">
              {active.name} ·{' '}
              {t('train.elapsed', {
                time: formatClock(Math.floor((now - Date.parse(active.startedAt)) / 1000)),
              })}
            </p>
          </div>
          {isStale(active, now) && (
            <div className="flex flex-col gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
              <p>{t('train.stale')}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void finishSession(user.id, active)}>
                  {t('train.finishIt')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void discardSession(user.id, active)}
                >
                  {t('train.discardIt')}
                </Button>
              </div>
            </div>
          )}
          <Link
            to="/session/$id"
            params={{ id: active.id }}
            className={cn(buttonVariants(), 'w-full')}
          >
            {t('train.continue')}
          </Link>
        </article>
      )}

      {!active && (
        <>
          <Link to="/today" className="bg-brand flex flex-col gap-3 rounded-3xl p-5 shadow-card">
            <span className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] uppercase opacity-90">
              <Sparkles className="size-4" aria-hidden />
              {t('smart.todayLink')}
            </span>
            <span className="font-display text-2xl leading-tight font-bold uppercase">{t('home.todayTitle')}</span>
            <span className="text-sm opacity-90">{t('home.todayHint')}</span>
            <span className="mt-1 flex h-12 items-center justify-center gap-2 rounded-2xl bg-white font-display text-base font-bold tracking-wider text-[#0a0e1f] uppercase">
              <Play className="size-4 fill-[#2f6bff] text-[#2f6bff]" aria-hidden />
              {t('home.todayCta')}
            </span>
          </Link>
          {locations.length > 1 && (
            <SelectField
              label={t('train.where')}
              value={where ?? ''}
              onChange={(e) => setLocationId(e.target.value)}
            >
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
                <Button className="h-auto w-full justify-start rounded-2xl py-3 shadow-card" size="lg" variant="outline" onClick={() => void start(r.id)}>
                  <span className="grid size-10 place-items-center rounded-xl bg-info-soft text-info">
                    <Play className="size-4 fill-current" aria-hidden />
                  </span>
                  <span className="flex flex-col items-start">
                    <span>{t('train.startRoutine', { name: r.name })}</span>
                    <span className="text-xs font-normal text-muted-foreground">{t('routines.exercises', { count: r.items.length })}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {routines.length === 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border bg-card p-4 text-sm">
              <p>{t('train.noRoutines')}</p>
              <div className="flex flex-wrap gap-2">
                <Link to="/routines/new" className={buttonVariants({ size: 'sm' })}>
                  {t('train.createRoutine')}
                </Link>
                <Link to="/exercises" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                  {t('train.browseExercises')}
                </Link>
              </div>
            </div>
          )}
          <Button size="lg" variant="outline" onClick={() => void start(null)}>
            <Play className="size-4" aria-hidden />
            {t('train.free')}
          </Button>
        </>
      )}

      {/* Only when the administrator has the AI turned on: otherwise the link leads nowhere. */}
      {coachStatus.data?.available && (
        <Link to="/coach" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium shadow-card">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <MessageSquare className="size-4" aria-hidden />
          </span>
          {t('coach.link')}
        </Link>
      )}
      <Link to="/recovery" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-sm font-medium shadow-card">
        <span className="grid size-9 place-items-center rounded-xl bg-info-soft text-info">
          <Activity className="size-4" aria-hidden />
        </span>
        {t('smart.recoveryLink')}
      </Link>

      <InstallPrompt />
    </section>
  );
}
