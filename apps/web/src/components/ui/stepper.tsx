import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';

const inputCls = 'h-12 w-full min-w-0 rounded-lg border border-border bg-background px-1 text-center text-lg tabular-nums';

/** Number box with large − / + buttons, easy to use with sweaty hands. */
export function Stepper({ label, value, onChange, step, min = 0, decimal = false }: { label: string; value: string; onChange: (v: string) => void; step: number; min?: number; decimal?: boolean }) {
  const bump = (dir: 1 | -1) => {
    const current = value === '' ? 0 : Number(value);
    const next = Math.max(min, Math.round((current + dir * step) * 100) / 100);
    onChange(String(next));
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" className="size-12 shrink-0 px-0" aria-label={`${t('session.less')} ${label}`} onClick={() => bump(-1)}>
          <Minus className="size-4" aria-hidden />
        </Button>
        <input
          aria-label={label}
          className={inputCls}
          type="number"
          inputMode={decimal ? 'decimal' : 'numeric'}
          step={decimal ? 'any' : 1}
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button type="button" size="sm" variant="outline" className="size-12 shrink-0 px-0" aria-label={`${t('session.more')} ${label}`} onClick={() => bump(1)}>
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

