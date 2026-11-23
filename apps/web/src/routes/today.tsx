import { useMemo, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowDown, ArrowUp, Plus, Repeat, Save, Sparkles, Trash2 } from 'lucide-react';
import { estimateMinutes, fitToTime, generateToday, type TodayItem } from '@gym/engine';
import { uuidv7 } from '@gym/shared';
import { PageSpinner } from '@/components/Spinner';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { Stepper } from '@/components/ui/stepper';
import { AnimatedThumbnail } from '@/features/catalog/ExerciseImages';
import { useExercises, type ExerciseView } from '@/features/catalog/exercises';
import { muscleName, names } from '@/features/catalog/labels';
import { useRecovery } from '@/features/smart/hooks';
import { ExercisePicker } from '@/features/training/ExercisePicker';
import { REST_PRESETS } from '@/features/training/SessionExerciseCard';
import { SubstituteSheet } from '@/features/training/SubstituteSheet';
import { emptyItem, saveRoutine, startSession } from '@/features/training/repo';
import { formatClock } from '@/features/training/rest-timer';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { formatDuration } from '@/lib/format';
import { useLocations, useProfile } from '@/lib/repos';

export const Route = createFileRoute('/today')({ component: TodayPage });

const MINUTES = [20, 30, 45, 60, 75, 90];
const isCardio = (i: Pick<TodayItem, 'seconds' | 'restSeconds'>) => Boolean(i.seconds) && i.restSeconds === 0;

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
  const [reason, setReason] = useState<string | null>(null);
  const [items, setItems] = useState<TodayItem[] | null>(null);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!profile || !recovery || !all) return <PageSpinner />;
  const location = locations.find((l) => l.id === locationId) ?? locations.find((l) => l.isDefault) ?? locations[0];
  const chosenMinutes = minutes ?? profile.sessionMinutes;

  function propose() {
    const plan = generateToday({
      goal: profile!.goal,
      level: profile!.level,
      minutes: chosenMinutes,
      equipment: location?.equipment ?? [],
      locationName: location?.name ?? '',
      recovery: recovery!,
      catalog: all!.map((e) => ({ ...e, hasImages: e.media.length > 0 })),
    });
    setItems(plan.items);
    setReason(plan.reason);
    setSaved(false);
  }

  const update = (n: number, patch: Partial<TodayItem>) => {
    setItems((cur) => cur!.map((it, i) => (i === n ? { ...it, ...patch } : it)));
    setSaved(false);
  };
  const move = (n: number, dir: -1 | 1) =>
    setItems((cur) => {
      const next = [...cur!];
      const [x] = next.splice(n, 1);
      next.splice(n + dir, 0, x!);
      return next;
    });

  async function start() {
    if (!items) return;
    const id = await startSession(user.id, {
      name: t('smart.todayTitle'),
      locationId: location?.id ?? null,
      plan: items.map((i) => ({ exerciseId: i.exerciseId, restSeconds: i.restSeconds, targetSets: i.sets, repMin: i.repMin, repMax: i.repMax, targetSeconds: i.seconds })),
    });
    await navigate({ to: '/session/$id', params: { id } });
  }

  async function saveAsRoutine() {
    if (!items) return;
    const date = new Date().toLocaleDateString('es', { day: 'numeric', month: 'short' });
    await saveRoutine(user.id, {
      id: uuidv7(),
      name: `${t('smart.todayTitle')} ${date}`.slice(0, 60),
      programId: null,
      weekIndex: null,
      dayIndex: null,
      locationId: location?.id ?? null,
      notes: null,
      items: items.map((i, position) => ({
        position,
        exerciseId: i.exerciseId,
        supersetGroup: null,
        targetSets: i.sets,
        repMin: i.repMin,
        repMax: i.repMax,
        targetSeconds: i.seconds,
        targetRir: null,
        restSeconds: i.restSeconds,
        notes: null,
      })),
    });
    setSaved(true);
  }

  const estimated = items ? estimateMinutes(items) : 0;
  const off = items ? estimated - chosenMinutes : 0;

  return (
    <div className={`flex flex-col gap-4 ${items ? 'pb-32' : ''}`}>
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
      <Button variant={items ? 'outline' : 'default'} onClick={propose}>
        <Sparkles className="size-4" aria-hidden />
        {items ? t('smart.regenerate') : t('smart.generate')}
      </Button>

      {items && items.length === 0 && <p>{t('smart.noExercises')}</p>}
      {items && items.length > 0 && (
        <section className="flex flex-col gap-3">
          {reason && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{reason}</p>}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <p role="status" className={`text-sm ${off > 0 || off < -5 ? 'font-medium text-amber-800' : 'text-muted-foreground'}`}>
              {t('smart.estimatedOf', { minutes: estimated, total: chosenMinutes })}
            </p>
            {(off > 0 || off < -5) && (
              <Button size="sm" variant="outline" onClick={() => setItems(fitToTime(items, chosenMinutes))}>
                {t('smart.fitTime')}
              </Button>
            )}
          </div>
          <ol className="flex flex-col gap-3">
            {items.map((item, n) => (
              <PlanCard
                key={`${item.exerciseId}-${n}`}
                n={n}
                count={items.length}
                item={item}
                exercise={byId.get(item.exerciseId)}
                onChange={(patch) => update(n, patch)}
                onSwap={() => setSwapping(n)}
                onRemove={() => setItems(items.filter((_, i) => i !== n))}
                onMove={(dir) => move(n, dir)}
              />
            ))}
          </ol>
          <Button variant="outline" onClick={() => setPicking(true)}>
            <Plus className="size-4" aria-hidden />
            {t('session.addExercise')}
          </Button>
          {saved && (
            <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-900">
              {t('smart.savedAsRoutine')}
            </p>
          )}
        </section>
      )}

      {items && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background">
          <div className="mx-auto grid max-w-md grid-cols-[auto_1fr] gap-2 px-4 py-2">
            <Button variant="outline" size="lg" className="px-4" aria-label={t('smart.saveAsRoutine')} disabled={saved} onClick={() => void saveAsRoutine()}>
              <Save className="size-5" aria-hidden />
              {saved ? t('smart.saved') : t('common.save')}
            </Button>
            <Button size="lg" onClick={() => void start()}>
              {t('smart.start')}
            </Button>
          </div>
        </div>
      )}

      {swapping !== null && items && (
        <SubstituteSheet
          target={byId.get(items[swapping]!.exerciseId)}
          candidates={all}
          exclude={items.map((i) => i.exerciseId)}
          location={location ?? null}
          onClose={() => setSwapping(null)}
          onPick={(exerciseId) => {
            update(swapping, { exerciseId, reason: t('smart.swapped') });
            setSwapping(null);
          }}
        />
      )}
      {picking && (
        <ExercisePicker
          userId={user.id}
          location={location ?? null}
          onClose={() => setPicking(false)}
          onPick={(ex) => {
            const base = emptyItem(ex.id, ex.measure);
            const strength = items?.find((i) => !isCardio(i));
            const added: TodayItem = {
              exerciseId: ex.id,
              sets: strength?.sets ?? base.targetSets,
              repMin: base.targetSeconds ? null : (strength?.repMin ?? base.repMin),
              repMax: base.targetSeconds ? null : (strength?.repMax ?? base.repMax),
              seconds: base.targetSeconds,
              restSeconds: strength?.restSeconds ?? base.restSeconds,
              reason: t('smart.addedByYou'),
            };
            // Before the cardio block, which stays last.
            setItems((cur) => {
              const list = [...(cur ?? [])];
              const at = list.findIndex(isCardio);
              list.splice(at === -1 ? list.length : at, 0, added);
              return list;
            });
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function PlanCard({
  n,
  count,
  item,
  exercise,
  onChange,
  onSwap,
  onRemove,
  onMove,
}: {
  n: number;
  count: number;
  item: TodayItem;
  exercise: ExerciseView | undefined;
  onChange: (patch: Partial<TodayItem>) => void;
  onSwap: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const name = exercise?.nameEs ?? item.exerciseId;
  const cardio = isCardio(item);
  const timed = item.seconds !== null;
  const restOptions = REST_PRESETS.includes(item.restSeconds) ? REST_PRESETS : [...REST_PRESETS, item.restSeconds].sort((a, b) => a - b);
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || min)));
  return (
    <li aria-label={name} className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <div className="flex items-start gap-3">
        <AnimatedThumbnail media={exercise?.media ?? []} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold leading-tight">
            {n + 1}. {name}
          </span>
          {exercise && exercise.primaryMuscles.length > 0 && <span className="text-sm text-muted-foreground">{names(exercise.primaryMuscles, muscleName)}</span>}
          <span className="text-xs text-muted-foreground">{item.reason}</span>
        </div>
        <div className="flex flex-col">
          <Button size="sm" variant="ghost" className="px-2" aria-label={t('routines.moveUp')} disabled={n === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" className="px-2" aria-label={t('routines.moveDown')} disabled={n === count - 1} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      {cardio ? (
        <Stepper
          label={t('session.minutesLabel')}
          value={String(Math.round(item.seconds! / 60))}
          onChange={(v) => onChange({ seconds: num(v, 1, 60) * 60 })}
          step={1}
          min={1}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Stepper label={t('routines.sets')} value={String(item.sets)} onChange={(v) => onChange({ sets: num(v, 1, 10) })} step={1} min={1} />
            {timed ? (
              <Stepper label={t('session.seconds')} value={String(item.seconds)} onChange={(v) => onChange({ seconds: num(v, 5, 600) })} step={5} min={5} />
            ) : (
              <label className="flex flex-col gap-1 text-xs">
                {t('session.restBetween')}
                <select className="h-12 rounded-lg border border-border bg-background px-2 text-base" value={item.restSeconds} onChange={(e) => onChange({ restSeconds: Number(e.target.value) })}>
                  {restOptions.map((r) => (
                    <option key={r} value={r}>
                      {r === 0 ? t('session.noRest') : formatClock(r)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {!timed && (
            <div className="grid grid-cols-2 gap-2">
              <Stepper label={t('routines.repMin')} value={String(item.repMin ?? '')} onChange={(v) => onChange({ repMin: num(v, 1, Math.min(100, item.repMax ?? 100)) })} step={1} min={1} />
              <Stepper label={t('routines.repMax')} value={String(item.repMax ?? '')} onChange={(v) => onChange({ repMax: num(v, Math.max(1, item.repMin ?? 1), 100) })} step={1} min={1} />
            </div>
          )}
        </div>
      )}

      <p className="text-sm font-medium">
        {cardio
          ? formatDuration(item.seconds!)
          : `${item.sets} × ${timed ? formatDuration(item.seconds!) : item.repMin === item.repMax ? item.repMin : `${item.repMin}–${item.repMax}`} · ${t('session.restShort', { rest: formatClock(item.restSeconds) })}`}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" aria-label={`${t('session.swap')}: ${name}`} onClick={onSwap}>
          <Repeat className="size-4" aria-hidden />
          {t('session.swapShort')}
        </Button>
        <Button size="sm" variant="ghost" aria-label={`${t('routines.remove')}: ${name}`} onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden />
          {t('smart.remove')}
        </Button>
      </div>
    </li>
  );
}
