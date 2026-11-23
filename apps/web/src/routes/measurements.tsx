import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { BodyMeasurementSchema, displayToKg, kgToDisplay, uuidv7 } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { FormError, TextField } from '@/components/ui/field';
import { LineSeries } from '@/features/progress/Charts';
import { deleteMeasurement, saveMeasurement, useMeasurements } from '@/features/progress/data';
import { t } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { formatNumber } from '@/lib/format';
import { useProfile } from '@/lib/repos';

export const Route = createFileRoute('/measurements')({ component: MeasurementsPage });

const today = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

function MeasurementsPage() {
  const user = useUser();
  const profile = useProfile(user.id);
  const list = useMeasurements(user.id) ?? [];
  const units = profile?.units ?? 'kg';
  const [form, setForm] = useState({ date: today(), weight: '', bodyFat: '', waist: '', chest: '', arm: '', thigh: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setError(null);
    const weight = num(form.weight);
    const m = {
      measuredAt: new Date(`${form.date}T12:00:00Z`).toISOString(),
      weightKg: weight === null ? null : displayToKg(weight, units),
      bodyFatPct: num(form.bodyFat),
      waistCm: num(form.waist),
      chestCm: num(form.chest),
      armCm: num(form.arm),
      thighCm: num(form.thigh),
      notes: form.notes.trim() || null,
    };
    const parsed = BodyMeasurementSchema.safeParse(m);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message === 'Indica al menos una medida.' ? t('measurements.needOne') : t('auth.errors.generic'));
    await saveMeasurement(user.id, { ...parsed.data, id: uuidv7() });
    setForm({ ...form, weight: '', bodyFat: '', waist: '', chest: '', arm: '', thigh: '', notes: '' });
  }

  const weights = [...list].reverse().filter((m) => m.weightKg !== null);
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-bold">{t('measurements.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('measurements.privacy')}</p>
      </header>

      {weights.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{t('measurements.chart')}</h2>
          <LineSeries
            unit={units}
            tableTitle={t('measurements.chart')}
            data={weights.map((m) => ({ label: new Date(m.measuredAt).toLocaleDateString('es', { day: 'numeric', month: 'short' }), value: kgToDisplay(m.weightKg!, units) }))}
          />
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="text-lg font-semibold">{t('measurements.add')}</h2>
        <TextField label={t('measurements.date')} type="date" value={form.date} max={today()} onChange={set('date')} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t('measurements.weight', { unit: units })} inputMode="decimal" value={form.weight} onChange={set('weight')} />
          <TextField label={t('measurements.bodyFat')} inputMode="decimal" value={form.bodyFat} onChange={set('bodyFat')} />
          <TextField label={t('measurements.waist')} inputMode="decimal" value={form.waist} onChange={set('waist')} />
          <TextField label={t('measurements.chest')} inputMode="decimal" value={form.chest} onChange={set('chest')} />
          <TextField label={t('measurements.arm')} inputMode="decimal" value={form.arm} onChange={set('arm')} />
          <TextField label={t('measurements.thigh')} inputMode="decimal" value={form.thigh} onChange={set('thigh')} />
        </div>
        <TextField label={t('measurements.notes')} value={form.notes} maxLength={500} onChange={set('notes')} />
        <FormError message={error} />
        <Button onClick={() => void save()}>{t('measurements.save')}</Button>
      </section>

      {list.length === 0 ? (
        <p className="text-muted-foreground">{t('measurements.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {list.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-medium">{new Date(m.measuredAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span className="block text-muted-foreground">
                  {[
                    m.weightKg !== null && `${formatNumber(kgToDisplay(m.weightKg, units))} ${units}`,
                    m.bodyFatPct !== null && `${formatNumber(m.bodyFatPct)} %`,
                    m.waistCm !== null && `${t('measurements.waist').split(' ')[0]} ${formatNumber(m.waistCm)} cm`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => void deleteMeasurement(user.id, m.id)}>
                {t('measurements.delete')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
