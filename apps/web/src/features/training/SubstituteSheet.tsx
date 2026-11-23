import { findSubstitutes } from '@gym/engine';
import { Button } from '@/components/ui/button';
import { Thumbnail } from '@/features/catalog/ExerciseImages';
import type { ExerciseView } from '@/features/catalog/exercises';
import { t } from '@/i18n';

/** Equivalent exercises (same muscles, doable with the place's equipment) to swap one for. */
export function SubstituteSheet({
  target,
  candidates,
  location,
  exclude = [],
  onPick,
  onClose,
}: {
  target: ExerciseView | undefined;
  candidates: ExerciseView[];
  /** Exercises already in the plan or session: offering them would duplicate an exercise. */
  exclude?: readonly string[];
  location: { name: string; equipment: readonly string[] } | null;
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const taken = new Set(exclude);
  const pool = candidates.filter((c) => !taken.has(c.id) || c.id === target?.id);
  const subs = target ? findSubstitutes(target, pool, location?.equipment ?? [], location?.name ?? '') : [];
  return (
    <div role="dialog" aria-modal="true" aria-label={t('session.substitutesTitle')} className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">{t('session.substitutesTitle')}</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t('picker.close')}
        </Button>
      </header>
      <ul className="mx-auto flex w-full max-w-md flex-col divide-y divide-border overflow-y-auto px-4">
        {subs.length === 0 && <li className="py-4 text-muted-foreground">{t('session.noSubstitutes')}</li>}
        {subs.map((s) => (
          <li key={s.exerciseId}>
            <button type="button" className="flex w-full items-center gap-3 py-3 text-left" onClick={() => onPick(s.exerciseId)}>
              <Thumbnail media={byId.get(s.exerciseId)?.media ?? []} />
              <span className="flex flex-col items-start gap-1">
                <span className="font-medium">{byId.get(s.exerciseId)?.nameEs ?? s.exerciseId}</span>
                <span className="text-sm text-muted-foreground">{s.reason}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

