import { useEffect, useMemo, useState } from 'react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { CheckSquare, ListPlus, Play, Plus, SlidersHorizontal, Square, Star, X } from 'lucide-react';
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
import { useExercises, useFavoriteIds, type ExerciseView } from '@/features/catalog/exercises';
import { muscleName, names } from '@/features/catalog/labels';
import { AddToRoutineSheet } from '@/features/training/AddToRoutineSheet';
import { startSession } from '@/features/training/repo';
import { t, tn } from '@/i18n';
import { useUser } from '@/lib/auth-context';
import { useLocations } from '@/lib/repos';

const PAGE = 60;

// Filters live in the URL: going back from an exercise returns to the same filtered list.
const SearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  place: z.string().optional().catch(undefined),
  muscle: z.string().optional().catch(undefined),
  equip: z.string().optional().catch(undefined),
  level: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  fav: z.boolean().optional().catch(undefined),
  n: z.number().int().positive().optional().catch(undefined),
});
type Search = z.infer<typeof SearchSchema>;

export const Route = createFileRoute('/exercises/')({ validateSearch: SearchSchema, component: ExercisesPage });

function ExercisesPage() {
  const user = useUser();
  const all = useExercises(user.id);
  const locations = useLocations(user.id) ?? [];
  const favorites = useFavoriteIds(user.id);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/exercises/' });
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [adding, setAdding] = useState(false);
  const limit = search.n ?? PAGE;

  const set = (patch: Partial<Search>) =>
    void navigate({ search: (prev: Search) => ({ ...prev, ...patch, n: undefined }), replace: true, resetScroll: false });

  const location = locations.find((l) => l.id === search.place);
  const results = useMemo(() => {
    const list = filterExercises(all ?? [], {
      text: search.q ?? '',
      muscle: (search.muscle || null) as MuscleSlug | null,
      equipment: (search.equip || null) as EquipmentSlug | null,
      availableEquipment: location ? location.equipment : null,
      level: search.level || null,
      category: search.type || null,
    });
    return search.fav ? list.filter((e) => favorites.has(e.id)) : list;
  }, [all, search, location, favorites]);

  // Back from an exercise: return to the same spot once the (locally loaded) list is rendered.
  const scrollKey = `exercises-scroll:${JSON.stringify(search)}`;
  const ready = all !== undefined && all.length > 0;
  useEffect(() => {
    if (!ready) return;
    const saved = readScroll(scrollKey);
    if (saved > 0) requestAnimationFrame(() => window.scrollTo(0, saved));
  }, [ready, scrollKey]);

  const activeFilters = [search.place, search.muscle, search.equip, search.level, search.type, search.fav].filter(Boolean).length;
  const byId = useMemo(() => new Map((all ?? []).map((e) => [e.id, e])), [all]);
  const chosen: ExerciseView[] = selected ? [...selected].map((id) => byId.get(id)).filter((e) => e !== undefined) : [];

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function trainNow() {
    const id = await startSession(user.id, {
      name: t('train.freeName'),
      locationId: location?.id ?? locations.find((l) => l.isDefault)?.id ?? null,
      plan: chosen.map((e) => ({ exerciseId: e.id, restSeconds: 90, supersetGroup: null, targetSets: 3, repMin: null, repMax: null, targetSeconds: e.measure === 'time' ? 30 : null })),
    });
    await navigate({ to: '/session/$id', params: { id } });
  }

  return (
    <div className={`flex flex-col gap-4 ${selected ? 'pb-24' : ''}`}>
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('exercises.title')}</h1>
        <div className="flex gap-2">
          {selected ? (
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
              <X className="size-4" aria-hidden />
              {t('common.cancel')}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                <CheckSquare className="size-4" aria-hidden />
                {t('exercises.select')}
              </Button>
              <Link to="/exercises/new" className={buttonVariants({ variant: 'outline', size: 'sm' })} aria-label={t('exercises.create')}>
                <Plus className="size-4" aria-hidden />
              </Link>
            </>
          )}
        </div>
      </header>

      <TextField
        label={t('exercises.search')}
        type="search"
        placeholder={t('exercises.searchPlaceholder')}
        value={search.q ?? ''}
        onChange={(e) => set({ q: e.target.value || undefined })}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant={showFilters ? 'default' : 'outline'} aria-expanded={showFilters} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="size-4" aria-hidden />
          {activeFilters ? t('exercises.filtersCount', { count: activeFilters }) : t('exercises.filters')}
        </Button>
        {activeFilters > 0 && (
          <Button size="sm" variant="ghost" onClick={() => void navigate({ search: { q: search.q }, replace: true })}>
            {t('exercises.clearFilters')}
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
          <SelectField label={t('exercises.location')} value={search.place ?? ''} onChange={(e) => set({ place: e.target.value || undefined })}>
            <option value="">{t('exercises.anyLocation')}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('exercises.muscle')} value={search.muscle ?? ''} onChange={(e) => set({ muscle: e.target.value || undefined })}>
            <option value="">{t('exercises.anyMuscle')}</option>
            {MUSCLES.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.nameEs}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('exercises.equipment')} value={search.equip ?? ''} onChange={(e) => set({ equip: e.target.value || undefined })}>
            <option value="">{t('exercises.anyEquipment')}</option>
            {EQUIPMENT.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.nameEs}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('exercises.level')} value={search.level ?? ''} onChange={(e) => set({ level: e.target.value || undefined })}>
            <option value="">{t('exercises.anyLevel')}</option>
            {EXERCISE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {t(`exercises.levels.${l}`)}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('exercises.category')} value={search.type ?? ''} onChange={(e) => set({ type: e.target.value || undefined })} className="col-span-2">
            <option value="">{t('exercises.anyCategory')}</option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameEs}
              </option>
            ))}
          </SelectField>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(search.fav)} onChange={(e) => set({ fav: e.target.checked || undefined })} className="size-4" />
            {t('exercises.onlyFavorites')}
          </label>
        </div>
      )}

      {all === undefined || all.length === 0 ? (
        <p role="status" className="text-muted-foreground">
          {t('exercises.loadingCatalog')}
        </p>
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {selected ? t('exercises.selectHint') : tn('exercises.results', results.length)}
          </p>
          {results.length === 0 && <p>{t('exercises.noResults')}</p>}
          <ul className="flex flex-col divide-y divide-border">
            {results.slice(0, limit).map((ex) => {
              const content = (
                <>
                  {selected &&
                    (selected.has(ex.id) ? <CheckSquare className="size-6 shrink-0 text-primary" aria-hidden /> : <Square className="size-6 shrink-0 text-muted-foreground" aria-hidden />)}
                  <Thumbnail media={ex.media} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1 font-medium">
                      {ex.nameEs}
                      {favorites.has(ex.id) && <Star className="size-4 fill-current" aria-label={t('exercises.favorite')} />}
                      {ex.own && <span className="rounded-full bg-muted px-2 text-xs">{t('exercises.mine')}</span>}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{names(ex.primaryMuscles, muscleName)}</span>
                  </span>
                </>
              );
              return (
                <li key={ex.id}>
                  {selected ? (
                    <button type="button" aria-pressed={selected.has(ex.id)} className="flex w-full items-center gap-3 py-3 text-left" onClick={() => toggle(ex.id)}>
                      {content}
                    </button>
                  ) : (
                    <Link to="/exercises/$id" params={{ id: ex.id }} className="flex items-center gap-3 py-3" onClick={() => saveScroll(scrollKey, window.scrollY)}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {results.length > limit && (
            <Button variant="outline" onClick={() => void navigate({ search: (prev: Search) => ({ ...prev, n: limit + PAGE }), replace: true, resetScroll: false })}>
              {t('exercises.showMore')}
            </Button>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background">
          <div className="mx-auto flex max-w-md flex-col gap-2 px-4 py-2">
            <span className="text-sm font-medium">{tn('exercises.selected', chosen.length)}</span>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled={chosen.length === 0} onClick={() => setAdding(true)}>
                <ListPlus className="size-4" aria-hidden />
                {t('exercises.toRoutine')}
              </Button>
              <Button variant="outline" disabled={chosen.length === 0} onClick={() => void trainNow()}>
                <Play className="size-4" aria-hidden />
                {t('exercises.trainNow')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {adding && (
        <AddToRoutineSheet
          userId={user.id}
          exercises={chosen}
          onClose={() => {
            setAdding(false);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}

function readScroll(key: string): number {
  try {
    return Number(sessionStorage.getItem(key) ?? 0);
  } catch {
    return 0;
  }
}

function saveScroll(key: string, y: number) {
  try {
    sessionStorage.setItem(key, String(Math.round(y)));
  } catch {
    // Private mode or storage blocked: going back simply starts at the top.
  }
}
