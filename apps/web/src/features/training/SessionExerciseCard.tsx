import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { BookOpen, Check, Repeat, SlidersHorizontal, X } from 'lucide-react';
import { Stepper } from '@/components/ui/stepper';
import { SET_TYPES, displayToKg, kgToDisplay, setProblem, type RoutineItem } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { AnimatedThumbnail, ExerciseImages } from '@/features/catalog/ExerciseImages';
import type { ExerciseView } from '@/features/catalog/exercises';
import { muscleName, names } from '@/features/catalog/labels';
import { t, tn } from '@/i18n';
import { formatDuration, formatNumber } from '@/lib/format';
import { newRecords, suggestNext, type RecordKind, type Suggestion } from '@gym/engine';
import { deleteSet, exerciseHistory, logSet, updateSessionTargets, type HistorySession, type LocalSessionExercise, type LocalSet, type SessionTargets } from './repo';
import { formatClock } from './rest-timer';

type Units = 'kg' | 'lb';

function describeSets(sets: LocalSet[], units: Units) {
  return sets
    .map((s) => {
      if (s.seconds !== null) return formatDuration(s.seconds);
      if (s.weightKg !== null && s.weightKg > 0) return `${formatNumber(kgToDisplay(s.weightKg, units))} ${units} × ${s.reps}`;
      return `${s.reps}`;
    })
    .join(' · ');
}

function describeSuggestion(s: Suggestion, units: Units) {
  if (s.seconds) return formatDuration(s.seconds);
  if (s.weightKg != null) return `${formatNumber(kgToDisplay(s.weightKg, units))} ${units} × ${s.reps}`;
  return `${s.reps} reps`;
}


function repRange(min: number | null, max: number | null) {
  if (min && max && min !== max) return `${min}–${max}`;
  if (!min && !max) return '8–12'; // same default range as the progression engine
  return String(min ?? max);
}

/** «3 series × 8–12 reps · descanso 1:30»; one set and no rest for cardio: «1 serie × 15 min». */
function goalLine(sets: number, target: string, restSeconds: number) {
  const line = `${tn('session.setsCount', sets)} × ${target}`;
  return restSeconds > 0 ? `${line} · ${t('session.restShort', { rest: formatClock(restSeconds) })}` : line;
}

export const REST_PRESETS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

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
  const [panel, setPanel] = useState<'howTo' | 'adjust' | null>(null);
  const toggle = (p: 'howTo' | 'adjust') => setPanel((cur) => (cur === p ? null : p));
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
  const timed = measure === 'time';
  const done = se.sets.length >= goal.targetSets;
  return (
    <section aria-label={name} className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-card ${done ? 'border-success/50 bg-success-soft' : 'border-border bg-card'}`}>
      <header className="flex items-start gap-3">
        {/* Tapping the picture opens the same guide as the «Cómo» button (which keyboard users get). */}
        <button type="button" className="shrink-0 rounded-lg" tabIndex={-1} aria-hidden onClick={() => toggle('howTo')}>
          <AnimatedThumbnail media={exercise?.media ?? []} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link to="/exercises/$id" params={{ id: se.exerciseId }} className="font-semibold leading-tight hover:underline">
            {name}
          </Link>
          {exercise && <p className="text-sm text-muted-foreground">{names(exercise.primaryMuscles, muscleName)}</p>}
          <p className="text-sm font-semibold text-info">
            {goalLine(goal.targetSets, timed ? formatDuration(goal.targetSeconds ?? 30) : `${repRange(goal.repMin, goal.repMax)} ${t('session.repsShort')}`, se.restSeconds)}
          </p>
          <p className="text-xs text-muted-foreground">
            {previous && previous.length ? t('session.last', { sets: describeSets(previous, units) }) : previous ? t('session.noLast') : ''}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant={panel === 'howTo' ? 'default' : 'outline'} aria-label={t('session.howTo')} aria-expanded={panel === 'howTo'} onClick={() => toggle('howTo')}>
          <BookOpen className="size-4" aria-hidden />
          {t('session.howToShort')}
        </Button>
        <Button size="sm" variant="outline" aria-label={t('session.swap')} onClick={onSwap}>
          <Repeat className="size-4" aria-hidden />
          {t('session.swapShort')}
        </Button>
        <Button size="sm" variant={panel === 'adjust' ? 'default' : 'outline'} aria-expanded={panel === 'adjust'} onClick={() => toggle('adjust')}>
          <SlidersHorizontal className="size-4" aria-hidden />
          {t('session.adjust')}
        </Button>
      </div>

      {panel === 'howTo' && exercise && (
        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
          <ExerciseImages media={exercise.media} alt={name} />
          {exercise.instructionsEs.length > 0 ? (
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
              {exercise.instructionsEs.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t('session.noSteps')}</p>
          )}
          <Link to="/exercises/$id" params={{ id: se.exerciseId }} className="text-sm underline">
            {t('session.fullDetail')}
          </Link>
        </div>
      )}

      {panel === 'adjust' && (
        <TargetsForm
          timed={timed}
          initial={{ targetSets: goal.targetSets, repMin: goal.repMin, repMax: goal.repMax, targetSeconds: goal.targetSeconds, restSeconds: se.restSeconds }}
          onCancel={() => setPanel(null)}
          onSave={async (targets) => {
            await updateSessionTargets(userId, se, targets);
            setPanel(null);
          }}
        />
      )}

      {se.sets.length > 0 && (
        <ol className="flex flex-col gap-1">
          {se.sets.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2 text-sm">
              <Check className="size-4 text-success" aria-hidden />
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
        <div className="flex flex-col gap-1 rounded-lg bg-info-soft px-3 py-2 text-sm text-info">
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
        <p role="status" className="rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
          {t('smart.newRecord', { kinds: records.map((k) => t(`smart.records.${k}`)).join(', ') })}
        </p>
      )}
      <NextSetRow
        key={`${index}-${history ? 'h' : 'n'}-${goal.repMax ?? ''}-${goal.targetSeconds ?? ''}-${suggestion?.weightKg ?? ''}-${units}`}
        defaults={defaults}
        index={index}
        total={goal.targetSets}
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
  total,
  measure,
  units,
  label,
  onLog,
}: {
  defaults: { weight: string; reps: string; seconds: string; meters: string };
  index: number;
  total: number;
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
  // Cardio (5 minutes or more) is entered in minutes; short holds stay in seconds.
  const inMinutes = measure === 'time' && Number(defaults.seconds) >= 300;
  const minutesValue = seconds === '' ? '' : String(Math.round((Number(seconds) / 60) * 10) / 10);

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

  const extra = index >= total;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{extra ? t('session.extraSet', { n: index + 1 }) : t('session.setOf', { n: index + 1, total })}</span>
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
      </div>
      <div className="flex flex-col gap-2 min-[400px]:flex-row">
        {measure === 'weight_reps' && <Stepper label={t('session.weight', { unit: units })} value={weight} onChange={setWeight} step={units === 'kg' ? 2.5 : 5} decimal />}
        {(measure === 'weight_reps' || measure === 'reps') && <Stepper label={t('session.reps')} value={reps} onChange={setReps} step={1} />}
        {measure === 'time' &&
          (inMinutes ? (
            <Stepper label={t('session.minutesLabel')} value={minutesValue} onChange={(v) => setSeconds(v === '' ? '' : String(Math.round(Number(v) * 60)))} step={1} min={1} decimal />
          ) : (
            <Stepper label={t('session.seconds')} value={seconds} onChange={setSeconds} step={5} />
          ))}
        {measure === 'distance' && <Stepper label={t('session.meters')} value={meters} onChange={setMeters} step={50} decimal />}
      </div>
      <Button size="lg" variant="brand" aria-label={`${t('session.log')}: ${label}`} onClick={() => void log()}>
        <Check className="size-5" aria-hidden />
        {t('session.log')}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Per-session goal for one exercise: sets, reps (or seconds) and rest between sets. */
function TargetsForm({ timed, initial, onSave, onCancel }: { timed: boolean; initial: SessionTargets; onSave: (t: SessionTargets) => Promise<void>; onCancel: () => void }) {
  const [sets, setSets] = useState(String(initial.targetSets ?? 3));
  const [repMin, setRepMin] = useState(String(initial.repMin ?? initial.repMax ?? 8));
  const [repMax, setRepMax] = useState(String(initial.repMax ?? initial.repMin ?? 12));
  const [secs, setSecs] = useState(String(initial.targetSeconds ?? 30));
  const [rest, setRest] = useState(initial.restSeconds);
  const [error, setError] = useState<string | null>(null);
  const restOptions = REST_PRESETS.includes(rest) ? REST_PRESETS : [...REST_PRESETS, rest].sort((a, b) => a - b);

  async function save() {
    const n = Number(sets);
    const min = Number(repMin);
    const max = Number(repMax);
    const s = Number(secs);
    if (!Number.isInteger(n) || n < 1 || n > 10) return setError(t('session.badSets'));
    if (timed) {
      if (!Number.isInteger(s) || s < 5 || s > 3600) return setError(t('session.badSeconds'));
    } else if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 100 || min > max) {
      return setError(t('session.badReps'));
    }
    await onSave({
      targetSets: n,
      repMin: timed ? null : min,
      repMax: timed ? null : max,
      targetSeconds: timed ? s : null,
      restSeconds: rest,
    });
  }

  return (
    <form
      aria-label={t('session.adjustTitle')}
      className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-sm font-semibold">{t('session.adjustTitle')}</p>
      <div className="flex flex-col gap-2">
        <Stepper label={t('routines.sets')} value={sets} onChange={setSets} step={1} min={1} />
        {timed ? (
          <Stepper label={t('session.seconds')} value={secs} onChange={setSecs} step={Number(secs) >= 300 ? 60 : 5} min={5} />
        ) : (
          <div className="flex gap-2">
            <Stepper label={t('routines.repMin')} value={repMin} onChange={setRepMin} step={1} min={1} />
            <Stepper label={t('routines.repMax')} value={repMax} onChange={setRepMax} step={1} min={1} />
          </div>
        )}
        <label className="flex flex-col gap-1 text-xs">
          {t('session.restBetween')}
          <select className="h-12 rounded-xl border border-border bg-card px-2 text-base" value={rest} onChange={(e) => setRest(Number(e.target.value))}>
            {restOptions.map((r) => (
              <option key={r} value={r}>
                {r === 0 ? t('session.noRest') : formatClock(r)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {t('common.save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
