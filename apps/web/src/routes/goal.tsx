import { useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Target } from 'lucide-react';
import { ACTIVITY_LABELS, ACTIVITY_LEVELS, uuidv7, type Profile } from '@gym/shared';
import { goalPlan } from '@gym/engine';
import { PageSpinner } from '@/components/Spinner';
import { Button, buttonVariants } from '@/components/ui/button';
import { FormError, SelectField, TextField } from '@/components/ui/field';
import { saveMeasurement, useMeasurements } from '@/features/progress/data';
import { t } from '@/i18n';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/lib/auth-context';
import { saveProfile, useProfile } from '@/lib/repos';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/goal')({ component: GoalPage });

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const str = (v: number | null | undefined) => (v == null ? '' : String(v));

const PACE_STYLE = {
  ok: 'bg-success-soft text-success',
  fast: 'bg-warning-soft text-warning',
  too_fast: 'bg-danger-soft text-danger',
  past_date: 'bg-danger-soft text-danger',
  none: 'bg-muted text-muted-foreground',
} as const;

function GoalPage() {
  const user = useUser();
  const profile = useProfile(user.id);
  const measurements = useMeasurements(user.id);
  if (!profile || measurements === undefined) return <PageSpinner />;
  const lastWeight = measurements.find((m) => m.weightKg != null)?.weightKg ?? profile.bodyweightKg ?? null;
  return <GoalForm userId={user.id} profile={profile} currentWeight={lastWeight} />;
}

function GoalForm({ userId, profile, currentWeight }: { userId: string; profile: Profile; currentWeight: number | null }) {
  const thisYear = new Date().getFullYear();
  const [f, setF] = useState({
    weight: str(currentWeight),
    height: str(profile.heightCm),
    age: profile.birthYear ? String(thisYear - profile.birthYear) : '',
    sex: profile.sex ?? '',
    target: str(profile.targetWeightKg),
    date: profile.targetDate ?? '',
    activity: profile.activityLevel ?? '',
    injuries: profile.injuries ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const coach = useQuery({
    queryKey: ['coach-status'],
    queryFn: () => apiFetch('/coach/status') as Promise<{ available: boolean }>,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setSaved(false);
    setF({ ...f, [k]: e.target.value });
  };
  const plan = goalPlan({ weightKg: num(f.weight), heightCm: num(f.height), targetWeightKg: num(f.target), targetDate: f.date || null });

  async function save() {
    setError(null);
    const weight = num(f.weight);
    const height = num(f.height);
    const age = num(f.age);
    const target = num(f.target);
    const bad =
      (weight !== null && !(weight >= 20 && weight <= 400)) ||
      (target !== null && !(target >= 25 && target <= 400)) ||
      (height !== null && !(Number.isInteger(height) && height >= 100 && height <= 250)) ||
      (age !== null && !(Number.isInteger(age) && age >= 13 && age <= 100));
    if (bad) return setError(t('goal.invalid'));
    await saveProfile(userId, {
      ...profile,
      bodyweightKg: weight,
      heightCm: height,
      birthYear: age === null ? null : thisYear - age,
      sex: (f.sex || null) as Profile['sex'],
      targetWeightKg: target,
      targetDate: f.date || null,
      activityLevel: (f.activity || null) as Profile['activityLevel'],
      injuries: f.injuries.trim() || null,
    });
    // A changed weight is also a progress entry, so the coach and the charts see the trend.
    if (weight !== null && weight !== currentWeight) {
      await saveMeasurement(userId, { id: uuidv7(), measuredAt: new Date().toISOString(), weightKg: weight, bodyFatPct: null, waistCm: null, chestCm: null, armCm: null, thighCm: null, notes: null });
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('goal.title')}</h1>
        <p className="text-muted-foreground">{t('goal.intro')}</p>
      </header>

      <section aria-labelledby="goal-body" className="flex flex-col gap-4">
        <h2 id="goal-body" className="text-lg font-semibold">{t('goal.body')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('goal.weight')} inputMode="decimal" value={f.weight} onChange={set('weight')} />
          <TextField label={t('goal.height')} inputMode="numeric" value={f.height} onChange={set('height')} />
          <TextField label={t('goal.age')} inputMode="numeric" value={f.age} onChange={set('age')} />
          <SelectField label={t('goal.sex')} value={f.sex} onChange={set('sex')}>
            <option value="">{t('goal.noAnswer')}</option>
            <option value="female">{t('goal.female')}</option>
            <option value="male">{t('goal.male')}</option>
            <option value="other">{t('goal.other')}</option>
          </SelectField>
        </div>
        <SelectField label={t('goal.activity')} value={f.activity} onChange={set('activity')}>
          <option value="">{t('goal.noAnswer')}</option>
          {ACTIVITY_LEVELS.map((a) => (
            <option key={a} value={a}>
              {ACTIVITY_LABELS[a]}
            </option>
          ))}
        </SelectField>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('goal.injuries')}
          <textarea
            rows={2}
            maxLength={300}
            value={f.injuries}
            placeholder={t('goal.injuriesPlaceholder')}
            onChange={set('injuries')}
            className="rounded-xl border border-border bg-card p-3 text-base font-normal"
          />
        </label>
      </section>

      <section aria-labelledby="goal-target" className="flex flex-col gap-4">
        <h2 id="goal-target" className="text-lg font-semibold">{t('goal.target')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('goal.targetWeight')} inputMode="decimal" value={f.target} onChange={set('target')} />
          <TextField label={t('goal.targetDate')} type="date" value={f.date} min={new Date().toISOString().slice(0, 10)} onChange={set('date')} />
        </div>
        <div role="status" className={cn('flex gap-3 rounded-2xl p-4 text-sm', PACE_STYLE[plan.pace])}>
          <Target className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-medium">{plan.message}</p>
            {plan.bmi !== null && <p>{t('goal.bmi', { bmi: plan.bmi.toLocaleString('es'), label: plan.bmiLabel ?? '' })}</p>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('goal.health')}</p>
      </section>

      <FormError message={error} />
      {saved && (
        <p role="status" className="text-sm text-success">
          {t('profile.saved')}
        </p>
      )}
      <Button size="lg" variant="brand" onClick={() => void save()}>
        {t('goal.save')}
      </Button>
      {coach.data?.available && saved && (
        <Link to="/coach" search={{ mode: 'goal' }} className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
          <Sparkles className="size-4" aria-hidden />
          {t('goal.askCoach')}
        </Link>
      )}
    </div>
  );
}
