import { useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { generateToday, type TodayRoutine } from '@gym/engine';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { useExercises } from '@/features/catalog/exercises';
import { useRecovery } from '@/features/smart/hooks';
import { startSession } from '@/features/training/repo';
import { t } from '@/i18n';
import { formatDuration } from '@/lib/format';
import { useUser } from '@/lib/auth-context';
import { useLocations, useProfile } from '@/lib/repos';

export const Route = createFileRoute('/today')({ component: TodayPage });

const MINUTES = [20, 30, 45, 60, 75, 90];

function TodayPage() {
  const user = useUser();
  const profile = useProfile(user.id);
  const locations = useLocations(user.id) ?? [];
  const all = useExercises(user.id);
  const byId = useMemo(() => new Map((all ?? []).map((e) => [e.id, e])), [all]);
  const recovery = useRecovery(user.id, byId);
  const navigate = useNavigate();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [locationId, setLocationId] = useState('');
  const [plan, setPlan] = useState<TodayRoutine | null>(null);

  if (!profile || !recovery || !all) return null;
  const location = locations.find((l) => l.id === locationId) ?? locations.find((l) => l.isDefault) ?? locations[0];
  const chosenMinutes = minutes ?? profile.sessionMinutes;

  function propose() {
    setPlan(
      generateToday({
        goal: profile!.goal,
        level: profile!.level,
        minutes: chosenMinutes,
        equipment: location?.equipment ?? [],
        locationName: location?.name ?? '',
        recovery: recovery!,
        catalog: all!.map((e) => ({ ...e, hasImages: e.media.length > 0 })),
      }),
    );
  }

  async function start() {
    if (!plan) return;
    const id = await startSession(user.id, {
      name: t('smart.todayTitle'),
      locationId: location?.id ?? null,
      plan: plan.items.map((i) => ({
        exerciseId: i.exerciseId,
        restSeconds: i.restSeconds,
        targetSets: i.sets,
        repMin: i.repMin,
        repMax: i.repMax,
        targetSeconds: i.seconds,
      })),
    });
    await navigate({ to: '/session/$id', params: { id } });
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('smart.todayTitle')}</h1>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('smart.minutes')} value={chosenMinutes} onChange={(e) => setMinutes(Number(e.target.value))}>
          {[...new Set([...MINUTES, profile.sessionMinutes])].sort((a, b) => a - b).map((m) => (
            <option key={m} value={m}>
              {t('smart.minutesOption', { count: m })}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('smart.location')} value={location?.id ?? ''} onChange={(e) => setLocationId(e.target.value)}>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
      </div>
      <Button onClick={propose}>{t('smart.generate')}</Button>

      {plan && plan.items.length === 0 && <p>{t('smart.noExercises')}</p>}
      {plan && plan.items.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{plan.reason}</p>
          <p className="text-sm text-muted-foreground">{t('smart.estimated', { minutes: plan.estimatedMinutes })}</p>
          <ol className="flex flex-col gap-2">
            {plan.items.map((i, n) => (
              <li key={i.exerciseId} className="flex flex-col rounded-lg border border-border p-3">
                <span className="font-medium">
                  {n + 1}. {byId.get(i.exerciseId)?.nameEs}
                </span>
                <span className="text-sm text-muted-foreground">
                  {i.seconds
                    ? formatDuration(i.seconds)
                    : t('smart.itemTarget', { sets: i.sets, reps: i.repMin === i.repMax ? `${i.repMin}` : `${i.repMin}–${i.repMax}` })}
                </span>
                <span className="text-xs text-muted-foreground">{i.reason}</span>
              </li>
            ))}
          </ol>
          <Button size="lg" onClick={() => void start()}>
            {t('smart.start')}
          </Button>
        </section>
      )}
    </div>
  );
}
