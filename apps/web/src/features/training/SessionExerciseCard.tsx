import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Check, Repeat, X } from 'lucide-react';
import { SET_TYPES, displayToKg, kgToDisplay, setProblem, type RoutineItem } from '@gym/shared';
import { Button } from '@/components/ui/button';
import type { ExerciseView } from '@/features/catalog/exercises';
import { muscleName, names } from '@/features/catalog/labels';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { newRecords, suggestNext, type RecordKind, type Suggestion } from '@gym/engine';
import { deleteSet, exerciseHistory, logSet, type HistorySession, type LocalSessionExercise, type LocalSet } from './repo';

type Units = 'kg' | 'lb';

function describeSets(sets: LocalSet[], units: Units) {
  return sets
    .map((s) => {
      if (s.seconds !== null) return `${s.seconds} s`;
      if (s.weightKg !== null && s.weightKg > 0) return `${formatNumber(kgToDisplay(s.weightKg, units))} ${units} × ${s.reps}`;
      return `${s.reps}`;
    })
    .join(' · ');
}

function describeSuggestion(s: Suggestion, units: Units) {
  if (s.seconds) return `${s.seconds} s`;
  if (s.weightKg != null) return `${formatNumber(kgToDisplay(s.weightKg, units))} ${units} × ${s.reps}`;
  return `${s.reps} reps`;
}

const inputCls = 'h-12 w-full rounded-lg border border-border bg-background px-2 text-center text-lg tabular-nums';

export function SessionExerciseCard({
  userId,
  sessionId,
  se,
  exercise,
  target,
  units,
  onLogged,
  onSwap,
}: {
  userId: string;
  sessionId: string;
  se: LocalSessionExercise & { sets: LocalSet[] };
  exercise: ExerciseView | undefined;
  target: RoutineItem | undefined;
  units: Units;
  onLogged: (restSeconds: number) => void;
  onSwap: () => void;
}) {
  const measure = exercise?.measure ?? 'weight_reps';
  const [history, setHistory] = useState<HistorySession[] | null>(null);
  const [records, setRecords] = useState<RecordKind[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  useEffect(() => {
    void exerciseHistory(userId, se.exerciseId, sessionId).then(setHistory);
  }, [userId, se.exerciseId, sessionId]);
  const previous = history ? (history[0]?.sets ?? []) : null;

  // Session targets (routine or today's plan) win over the routine lookup.
  const goal = {
    targetSets: se.targetSets ?? target?.targetSets ?? 3,
    repMin: se.repMin ?? target?.repMin ?? null,
    repMax: se.repMax ?? target?.repMax ?? null,
    targetSeconds: se.targetSeconds ?? target?.targetSeconds ?? null,
  };
  const suggestion: Suggestion | null = useMemo(
    () => (history ? suggestNext({ measure, equipment: exercise?.equipment ?? [], target: goal, history, units }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, measure, exercise?.equipment, goal.targetSets, goal.repMin, goal.repMax, goal.targetSeconds, units],
  );

  // Prefill the next set: last set of today, else the engine suggestion, else last time, else target.
  const index = se.sets.length;
  const today = se.sets.at(-1);
  const lastTime = previous?.[index] ?? previous?.at(-1);
  const weightKg = today?.weightKg ?? suggestion?.weightKg ?? lastTime?.weightKg ?? null;
  const defaults = {
    weight: weightKg != null ? String(kgToDisplay(weightKg, units)) : '',
    reps: String(today?.reps ?? suggestion?.reps ?? lastTime?.reps ?? goal.repMax ?? goal.repMin ?? (measure === 'time' ? '' : 10)),
    seconds: String(today?.seconds ?? suggestion?.seconds ?? lastTime?.seconds ?? goal.targetSeconds ?? (measure === 'time' ? 30 : '')),
    meters: lastTime?.meters != null ? String(lastTime.meters) : '',
  };

  const name = exercise?.nameEs ?? se.exerciseId;
  return (
    <section aria-label={name} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to="/exercises/$id" params={{ id: se.exerciseId }} className="font-semibold hover:underline">
            {name}
          </Link>
          {exercise && <p className="text-sm text-muted-foreground">{names(exercise.primaryMuscles, muscleName)}</p>}
          {(se.targetSets || target) && (
            <p className="text-sm text-muted-foreground">
              {t('routines.target', {
                sets: goal.targetSets,
                reps: goal.targetSeconds ? `${goal.targetSeconds} s` : goal.repMin === goal.repMax || !goal.repMax ? `${goal.repMin ?? goal.repMax ?? ''}` : `${goal.repMin}–${goal.repMax}`,
              })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {previous && previous.length ? t('session.last', { sets: describeSets(previous, units) }) : previous ? t('session.noLast') : ''}
          </p>
        </div>
        <Button size="sm" variant="ghost" aria-label={t('session.swap')} onClick={onSwap}>
          <Repeat className="size-4" aria-hidden />
        </Button>
      </header>

      {se.sets.length > 0 && (
        <ol className="flex flex-col gap-1">
          {se.sets.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-14 text-muted-foreground">
                {t('session.set')} {i + 1}
              </span>
              <span className="flex-1 font-medium tabular-nums">{describeSets([s], units)}</span>
              {s.type !== 'normal' && <span className="rounded-full bg-muted px-2 text-xs">{t(`session.types.${s.type}`)}</span>}
              <Button size="sm" variant="ghost" aria-label={`${t('session.deleteSet')} ${i + 1}`} onClick={() => void deleteSet(userId, s.id)}>
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {suggestion && index === 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <div className="flex items-center justify-between gap-2">
            <span>
              {t('smart.suggestion')}: <strong>{describeSuggestion(suggestion, units)}</strong>
            </span>
            <button type="button" className="underline" aria-expanded={showWhy} onClick={() => setShowWhy((v) => !v)}>
              {t('smart.why')}
            </button>
          </div>
          {showWhy && <p>{suggestion.reason}</p>}
        </div>
      )}
      {records.length > 0 && (
        <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
          {t('smart.newRecord', { kinds: records.map((k) => t(`smart.records.${k}`)).join(', ') })}
        </p>
      )}
      <NextSetRow
        key={`${index}-${history ? 'h' : 'n'}-${goal.repMax ?? ''}-${goal.targetSeconds ?? ''}-${suggestion?.weightKg ?? ''}-${units}`}
        defaults={defaults}
        index={index}
        measure={measure}
        units={units}
        label={name}
        onLog={async (values, type) => {
          const before = [...(history ?? []).flatMap((h) => h.sets), ...se.sets];
          await logSet(userId, {
            ...values,
            sessionExerciseId: se.id,
            position: index,
            type,
            rir: null,
            rpe: null,
            // Keep what the engine proposed next to what was done (constitution IV: explainable).
            suggested: suggestion && index === 0 ? { weightKg: suggestion.weightKg, reps: suggestion.reps, seconds: suggestion.seconds, reason: suggestion.reason } : null,
          });
          setRecords(newRecords(before, { ...values, rir: null, type }));
          onLogged(se.restSeconds);
        }}
      />
    </section>
  );
}

type Measure = 'weight_reps' | 'reps' | 'time' | 'distance';
type SetValues = { weightKg: number | null; reps: number | null; seconds: number | null; meters: number | null };

/** Inputs for the next set, initialized from `defaults`; a new key resets it after each logged set. */
function NextSetRow({
  defaults,
  index,
  measure,
  units,
  label,
  onLog,
}: {
  defaults: { weight: string; reps: string; seconds: string; meters: string };
  index: number;
  measure: Measure;
  units: Units;
  label: string;
  onLog: (values: SetValues, type: (typeof SET_TYPES)[number]) => Promise<void>;
}) {
  const [weight, setWeight] = useState(defaults.weight);
  const [reps, setReps] = useState(defaults.reps);
  const [seconds, setSeconds] = useState(defaults.seconds);
  const [meters, setMeters] = useState(defaults.meters);
  const [type, setType] = useState<(typeof SET_TYPES)[number]>('normal');
  const [error, setError] = useState<string | null>(null);

  async function log() {
    const values: SetValues = {
      weightKg: measure === 'weight_reps' && weight !== '' ? displayToKg(Number(weight), units) : null,
      reps: measure === 'weight_reps' || measure === 'reps' ? (reps === '' ? null : Number(reps)) : null,
      seconds: measure === 'time' ? (seconds === '' ? null : Number(seconds)) : null,
      meters: measure === 'distance' ? (meters === '' ? null : Number(meters)) : null,
    };
    const problem = setProblem(values, measure);
    if (problem) return setError(problem);
    await onLog(values, type);
  }

  return (
    <>
      <div className="flex items-end gap-2">
        <span className="w-14 pb-3 text-sm text-muted-foreground">
          {t('session.set')} {index + 1}
        </span>
        {measure === 'weight_reps' && (
          <label className="flex flex-1 flex-col gap-1 text-xs">
            {t('session.weight', { unit: units })}
            <input aria-label={t('session.weight', { unit: units })} className={inputCls} type="number" inputMode="decimal" step="0.5" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
        )}
        {(measure === 'weight_reps' || measure === 'reps') && (
          <label className="flex flex-1 flex-col gap-1 text-xs">
            {t('session.reps')}
            <input aria-label={t('session.reps')} className={inputCls} type="number" inputMode="numeric" min={0} value={reps} onChange={(e) => setReps(e.target.value)} />
          </label>
        )}
        {measure === 'time' && (
          <label className="flex flex-1 flex-col gap-1 text-xs">
            {t('session.seconds')}
            <input aria-label={t('session.seconds')} className={inputCls} type="number" inputMode="numeric" min={0} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
          </label>
        )}
        {measure === 'distance' && (
          <label className="flex flex-1 flex-col gap-1 text-xs">
            {t('session.meters')}
            <input aria-label={t('session.meters')} className={inputCls} type="number" inputMode="decimal" min={0} value={meters} onChange={(e) => setMeters(e.target.value)} />
          </label>
        )}
        <Button size="lg" aria-label={`${t('session.log')}: ${label}`} onClick={() => void log()}>
          <Check className="size-5" aria-hidden />
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        {t('session.type')}
        <select className="rounded border border-border bg-background px-1 py-0.5" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {SET_TYPES.map((st) => (
            <option key={st} value={st}>
              {t(`session.types.${st}`)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}
