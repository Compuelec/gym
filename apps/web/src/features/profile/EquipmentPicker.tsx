import { EQUIPMENT, type EquipmentSlug } from '@gym/shared';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';

const GROUPS = [
  { category: 'free_weights', title: t('equipmentGroups.free_weights') },
  { category: 'support', title: t('equipmentGroups.support') },
  { category: 'machines', title: t('equipmentGroups.machines') },
  { category: 'cardio', title: t('equipmentGroups.cardio') },
  { category: 'accessories', title: t('equipmentGroups.accessories') },
  { category: 'other', title: t('equipmentGroups.other') },
] as const;

/** Toggle chips for the equipment available at a location, grouped by kind. */
export function EquipmentPicker({
  value,
  onChange,
  label,
}: {
  value: EquipmentSlug[];
  onChange: (next: EquipmentSlug[]) => void;
  label: string;
}) {
  const selected = new Set(value);
  // Always keep the catalog order, whatever the tapping order was.
  const toggle = (slug: EquipmentSlug) =>
    onChange(
      EQUIPMENT.map((e) => e.slug).filter((s) => (s === slug ? !selected.has(s) : selected.has(s))),
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {GROUPS.map((group) => (
        <div key={group.category} className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">{group.title}</span>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.filter((e) => e.category === group.category).map((item) => {
              const on = selected.has(item.slug);
              return (
                <label
                  key={item.slug}
                  className={cn(
                    'cursor-pointer rounded-full border px-3 py-1.5 text-sm',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => toggle(item.slug)}
                  />
                  {item.nameEs}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
