import { cn } from '@/lib/utils';

/** Large tappable option (radio or checkbox look) for wizard choices. */
export function Choice({
  checked,
  onChange,
  label,
  description,
  type = 'radio',
  name,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  type?: 'radio' | 'checkbox';
  name?: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3',
        checked ? 'border-primary bg-muted' : 'border-border',
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-current"
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </span>
    </label>
  );
}
