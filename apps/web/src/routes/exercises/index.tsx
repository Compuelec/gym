import { useMemo, useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Plus, Star } from 'lucide-react';
import {
  CATEGORIES,
  EQUIPMENT,
  EXERCISE_LEVELS,
  MUSCLES,
  filterExercises,
  type EquipmentSlug,
  type MuscleSlug,
} from '@gym/shared';
import { Button, buttonVariants } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Thumbnail } from '@/features/catalog/ExerciseImages';
import { useExercises, useFavoriteIds } from '@/features/catalog/exercises';
import { muscleName, names } from '@/features/catalog/labels';
import { t, tn } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';

export const Route = createFileRoute('/exercises/')({ component: ExercisesPage });

const PAGE = 60;

function ExercisesPage() {
  const user = useUser();
  const all = useExercises(user.id);
  const locations = useLocations(user.id) ?? [];
  const favorites = useFavoriteIds(user.id);
  const [text, setText] = useState('');
  const [locationId, setLocationId] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const location = locations.find((l) => l.id === locationId);
  const results = useMemo(() => {
    const list = filterExercises(all ?? [], {
      text,
      muscle: (muscle || null) as MuscleSlug | null,
      equipment: (equipment || null) as EquipmentSlug | null,
      availableEquipment: location ? location.equipment : null,
      level: level || null,
      category: category || null,
    });
    return onlyFavorites ? list.filter((e) => favorites.has(e.id)) : list;
  }, [all, text, muscle, equipment, location, level, category, onlyFavorites, favorites]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('exercises.title')}</h1>
        <Link to="/exercises/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Plus className="size-4" aria-hidden />
          {t('exercises.create')}
        </Link>
      </header>

      <TextField
        label={t('exercises.search')}
        type="search"
        placeholder={t('exercises.searchPlaceholder')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label={t('exercises.location')}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          <option value="">{t('exercises.anyLocation')}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('exercises.muscle')}
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
        >
          <option value="">{t('exercises.anyMuscle')}</option>
          {MUSCLES.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.nameEs}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('exercises.equipment')}
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
        >
          <option value="">{t('exercises.anyEquipment')}</option>
          {EQUIPMENT.map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.nameEs}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('exercises.level')}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="">{t('exercises.anyLevel')}</option>
          {EXERCISE_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`exercises.levels.${l}`)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('exercises.category')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="col-span-2"
        >
          <option value="">{t('exercises.anyCategory')}</option>
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nameEs}
            </option>
          ))}
        </SelectField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyFavorites}
          onChange={(e) => setOnlyFavorites(e.target.checked)}
          className="size-4"
        />
        {t('exercises.onlyFavorites')}
      </label>

      {all === undefined || all.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {t('exercises.loadingCatalog')}
        </p>
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {tn('exercises.results', results.length)}
          </p>
          {results.length === 0 && <p>{t('exercises.noResults')}</p>}
          <ul className="flex flex-col divide-y divide-border">
            {results.slice(0, limit).map((ex) => (
              <li key={ex.id}>
                <Link
                  to="/exercises/$id"
                  params={{ id: ex.id }}
                  className="flex items-center gap-3 py-3"
                >
                  <Thumbnail media={ex.media} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1 font-medium">
                      {ex.nameEs}
                      {favorites.has(ex.id) && (
                        <Star
                          className="size-4 fill-current"
                          aria-label={t('exercises.favorite')}
                        />
                      )}
                      {ex.own && (
                        <span className="rounded-full bg-muted px-2 text-xs">
                          {t('exercises.mine')}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {names(ex.primaryMuscles, muscleName)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {results.length > limit && (
            <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
              {t('exercises.showMore')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
