import { EQUIPMENT, type EquipmentSlug } from '@gym/shared';
import { cn } from '@/lib/utils';

/** Toggle chips for the equipment available at a location. */
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
    onChange(EQUIPMENT.map((e) => e.slug).filter((s) => (s === slug ? !selected.has(s) : selected.has(s))));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {EQUIPMENT.map((item) => {
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
    </fieldset>
  );
}
