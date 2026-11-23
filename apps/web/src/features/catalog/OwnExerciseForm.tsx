import { useState } from 'react';
import { EQUIPMENT_SLUGS, MEASURES, CATEGORIES, EXERCISE_LEVELS, MUSCLES, type MuscleSlug, type OwnExercise } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { FormError, SelectField, TextField } from '@/components/ui/field';
import { EquipmentPicker } from '@/features/profile/EquipmentPicker';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import type { LocalOwnExercise } from './exercises';

export function emptyOwnExercise(id: string): LocalOwnExercise {
  return {
    id,
    nameEs: '',
    instructionsEs: [],
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    level: 'beginner',
    category: 'strength',
    mechanic: null,
    force: null,
    measure: 'weight_reps',
    notes: null,
  };
}

function MusclePicker({ label, value, onChange }: { label: string; value: MuscleSlug[]; onChange: (v: MuscleSlug[]) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {MUSCLES.map((m) => {
          const on = value.includes(m.slug);
          return (
            <label key={m.slug} className={cn('cursor-pointer rounded-full border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => onChange(on ? value.filter((s) => s !== m.slug) : [...value, m.slug])}
              />
              {m.nameEs}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function OwnExerciseForm({ initial, onSave }: { initial: LocalOwnExercise; onSave: (e: LocalOwnExercise) => Promise<void> }) {
  const [draft, setDraft] = useState(initial);
  const [steps, setSteps] = useState(initial.instructionsEs.join('\n'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<OwnExercise>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit() {
    setError(null);
    if (!draft.nameEs.trim()) return setError(t('exercises.own.needName'));
    if (draft.primaryMuscles.length === 0) return setError(t('exercises.own.needMuscle'));
    setBusy(true);
    await onSave({
      ...draft,
      nameEs: draft.nameEs.trim(),
      instructionsEs: steps.split('\n').map((s) => s.trim()).filter(Boolean),
      secondaryMuscles: draft.secondaryMuscles.filter((m) => !draft.primaryMuscles.includes(m)),
      equipment: draft.equipment.filter((e) => EQUIPMENT_SLUGS.includes(e)),
    });
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <TextField label={t('exercises.own.name')} value={draft.nameEs} maxLength={120} onChange={(e) => set({ nameEs: e.target.value })} />
      <MusclePicker label={t('exercises.primary')} value={draft.primaryMuscles} onChange={(primaryMuscles) => set({ primaryMuscles })} />
      <MusclePicker label={t('exercises.secondary')} value={draft.secondaryMuscles} onChange={(secondaryMuscles) => set({ secondaryMuscles })} />
      <EquipmentPicker label={t('exercises.equipment')} value={draft.equipment} onChange={(equipment) => set({ equipment })} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('exercises.level')} value={draft.level} onChange={(e) => set({ level: e.target.value as OwnExercise['level'] })}>
          {EXERCISE_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`exercises.levels.${l}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('exercises.category')} value={draft.category} onChange={(e) => set({ category: e.target.value as OwnExercise['category'] })}>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameEs}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('exercises.measure')} value={draft.measure} onChange={(e) => set({ measure: e.target.value as OwnExercise['measure'] })}>
          {MEASURES.map((m) => (
            <option key={m} value={m}>
              {t(`exercises.measures.${m}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('exercises.own.mechanic')}
          value={draft.mechanic ?? ''}
          onChange={(e) => set({ mechanic: (e.target.value || null) as OwnExercise['mechanic'] })}
        >
          <option value="">{t('exercises.own.none')}</option>
          <option value="compound">{t('exercises.mechanics.compound')}</option>
          <option value="isolation">{t('exercises.mechanics.isolation')}</option>
        </SelectField>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t('exercises.own.instructions')}
        <textarea
          rows={5}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
          className="rounded-lg border border-border bg-background p-3 text-base font-normal"
        />
      </label>
      <FormError message={error} />
      <Button size="lg" onClick={() => void submit()} disabled={busy}>
        {t('common.save')}
      </Button>
    </div>
  );
}
