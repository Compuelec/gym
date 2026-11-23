import { GOALS, GOAL_LABELS, LEVELS, LEVEL_LABELS, type Profile } from '@gym/shared';
import { SelectField } from '@/components/ui/field';
import { t } from '@/i18n';

export type TrainingValues = Pick<Profile, 'goal' | 'level' | 'daysPerWeek' | 'sessionMinutes' | 'units'>;

export const MINUTE_OPTIONS = [20, 30, 45, 60, 75, 90];

/** Goal, level, days, minutes and units — shared by onboarding and the profile screen. */
export function TrainingFields({ value, onChange }: { value: TrainingValues; onChange: (v: TrainingValues) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <SelectField label={t('onboarding.goal')} value={value.goal} onChange={(e) => onChange({ ...value, goal: e.target.value as Profile['goal'] })}>
        {GOALS.map((g) => (
          <option key={g} value={g}>
            {GOAL_LABELS[g]}
          </option>
        ))}
      </SelectField>
      <SelectField label={t('onboarding.level')} value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as Profile['level'] })}>
        {LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABELS[l]}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label={t('onboarding.days')} value={value.daysPerWeek} onChange={(e) => onChange({ ...value, daysPerWeek: Number(e.target.value) })}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('onboarding.minutes')} value={value.sessionMinutes} onChange={(e) => onChange({ ...value, sessionMinutes: Number(e.target.value) })}>
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField label={t('onboarding.units')} value={value.units} onChange={(e) => onChange({ ...value, units: e.target.value as Profile['units'] })}>
        <option value="kg">{t('onboarding.unitsKg')}</option>
        <option value="lb">{t('onboarding.unitsLb')}</option>
      </SelectField>
    </div>
  );
}
