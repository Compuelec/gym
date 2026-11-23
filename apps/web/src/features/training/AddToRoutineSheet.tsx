import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Check, Plus, X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t, tn } from '@/i18n';
import { addExercisesToRoutine, MAX_ROUTINE_ITEMS, useRoutines } from './repo';

/**
 * Bottom sheet to put one or more exercises into a routine: an existing one (appended with
 * default sets, reps and rest) or a new routine that starts with them.
 */
export function AddToRoutineSheet({
  userId,
  exercises,
  onClose,
}: {
  userId: string;
  exercises: Array<{ id: string; measure: string }>;
  onClose: () => void;
}) {
  const routines = useRoutines(userId);
  const navigate = useNavigate();
  const [done, setDone] = useState<{ routineId: string; name: string; added: number } | null>(null);

  return (
    <div role="dialog" aria-modal="true" aria-label={t('addToRoutine.title')} className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="mx-auto flex max-h-[80dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tn('addToRoutine.heading', exercises.length)}</h2>
          <Button size="sm" variant="ghost" aria-label={t('picker.close')} onClick={onClose}>
            <X className="size-5" aria-hidden />
          </Button>
        </header>

        {done ? (
          <div role="status" className="flex flex-col gap-3">
            <p className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
              <Check className="size-4" aria-hidden />
              {done.added > 0 ? tn('addToRoutine.added', done.added, { name: done.name }) : t('addToRoutine.already', { name: done.name })}
            </p>
            <div className="flex gap-2">
              <Link to="/routines/$id/edit" params={{ id: done.routineId }} className={cn(buttonVariants({ variant: 'outline' }), 'flex-1')}>
                {t('addToRoutine.open')}
              </Link>
              <Button className="flex-1" onClick={onClose}>
                {t('addToRoutine.keepBrowsing')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              onClick={() => void navigate({ to: '/routines/new', search: { ex: exercises.map((e) => e.id).join(',') } })}
            >
              <Plus className="size-4" aria-hidden />
              {t('addToRoutine.newRoutine')}
            </Button>
            {routines && routines.length > 0 && <p className="text-sm text-muted-foreground">{t('addToRoutine.orExisting')}</p>}
            <ul className="flex flex-col divide-y divide-border">
              {(routines ?? []).map((r) => {
                const full = r.items.length >= MAX_ROUTINE_ITEMS;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={full}
                      className="flex w-full items-center justify-between gap-2 py-3 text-left disabled:opacity-50"
                      onClick={async () => setDone({ routineId: r.id, name: r.name, added: await addExercisesToRoutine(userId, r, exercises) })}
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className="text-sm text-muted-foreground">{full ? t('addToRoutine.full') : t('routines.exercises', { count: r.items.length })}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
