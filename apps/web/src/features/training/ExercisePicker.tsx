import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { searchExercises } from '@gym/shared';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Thumbnail } from '@/features/catalog/ExerciseImages';
import { useExercises, type ExerciseView } from '@/features/catalog/exercises';
import { muscleName, names } from '@/features/catalog/labels';
import { t, tn } from '@/i18n';

const PAGE = 50;

/** Full-screen sheet to pick an exercise, optionally limited to a location's equipment. */
export function ExercisePicker({
  userId,
  location,
  onPick,
  onClose,
}: {
  userId: string;
  location: { name: string; equipment: readonly string[] } | null;
  onPick: (ex: ExerciseView) => void;
  onClose: () => void;
}) {
  const allRaw = useExercises(userId);
  const all = useMemo(() => allRaw ?? [], [allRaw]);
  const [text, setText] = useState('');
  const [onlyHere, setOnlyHere] = useState(Boolean(location));
  const [limit, setLimit] = useState(PAGE);
  const search = useMemo(
    () =>
      searchExercises(all, {
        text,
        availableEquipment: onlyHere && location ? location.equipment : null,
      }),
    [all, text, onlyHere, location],
  );
  // Exercises the location filter hides: offered with one tap instead of looking "missing".
  const hidden = useMemo(
    () =>
      onlyHere && location
        ? searchExercises(all, { text }).results.length - search.results.length
        : 0,
    [all, text, onlyHere, location, search],
  );
  // The page behind must not scroll while the sheet is open (iOS chains the scroll otherwise).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('picker.title')}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">{t('picker.title')}</h2>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label={t('picker.close')}>
          <X className="size-5" aria-hidden />
        </Button>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <TextField
          label={t('exercises.search')}
          type="search"
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setLimit(PAGE);
          }}
        />
        {location && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={onlyHere}
              onChange={(e) => {
                setOnlyHere(e.target.checked);
                setLimit(PAGE);
              }}
            />
            {t('picker.onlyLocation', { location: location.name })}
          </label>
        )}
        {search.approximate && (
          <p className="text-sm text-muted-foreground">{t('exercises.approximate')}</p>
        )}
        {hidden > 0 && location && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOnlyHere(false);
              setLimit(PAGE);
            }}
          >
            {tn('exercises.hiddenByEquipment', hidden, { location: location.name })}
          </Button>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {search.results.slice(0, limit).map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 py-2 text-left"
                onClick={() => onPick(ex)}
              >
                <Thumbnail media={ex.media} />
                <span className="flex flex-col">
                  <span className="font-medium">{ex.nameEs}</span>
                  <span className="text-sm text-muted-foreground">
                    {names(ex.primaryMuscles, muscleName)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {search.results.length > limit && (
          <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>
            {t('exercises.showMore')}
          </Button>
        )}
      </div>
    </div>
  );
}
