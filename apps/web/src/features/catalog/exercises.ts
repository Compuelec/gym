import { useLiveQuery } from 'dexie-react-hooks';
import { uuidv7, type CatalogExercise, type Media, type OwnExercise } from '@gym/shared';
import { getDB } from '@/db/database';
import { deleteRecord, saveRecord } from '@/db/sync';
import { getSyncEngine } from '@/lib/sync-client';

/** A catalog or own exercise, as screens use it. */
export type ExerciseView = Omit<CatalogExercise, 'id' | 'source' | 'catalogVersion' | 'sourceUrl'> & {
  id: string;
  own: boolean;
  sourceUrl: string | null;
  notes?: string | null;
};

export type LocalOwnExercise = OwnExercise & { id: string };

function fromOwn(ex: LocalOwnExercise): ExerciseView {
  return {
    ...ex,
    own: true,
    nameEn: null,
    translated: true,
    media: [] as Media[],
    license: '',
    authors: [],
    sourceUrl: null,
    retiredAt: null,
  };
}

function fromCatalog(ex: CatalogExercise): ExerciseView {
  return { ...ex, own: false };
}

/** Catalog + the user's own exercises; `undefined` while loading. */
export function useExercises(userId: string): ExerciseView[] | undefined {
  return useLiveQuery(async () => {
    const db = getDB(userId);
    const [catalog, own] = await Promise.all([
      db.table<CatalogExercise, string>('catalog').toArray(),
      db.entityTable('exercise').toArray() as unknown as Promise<LocalOwnExercise[]>,
    ]);
    return [...own.map(fromOwn), ...catalog.map(fromCatalog)];
  }, [userId]);
}

/** One exercise by id; `null` when it does not exist. */
export function useExercise(userId: string, id: string): ExerciseView | null | undefined {
  return useLiveQuery(async () => {
    const db = getDB(userId);
    const own = (await db.entityTable('exercise').get(id)) as LocalOwnExercise | undefined;
    if (own) return fromOwn(own);
    const cat = await db.table<CatalogExercise, string>('catalog').get(id);
    return cat ? fromCatalog(cat) : null;
  }, [userId, id]);
}

export function useFavoriteIds(userId: string): Set<string> {
  const rows = useLiveQuery(() => getDB(userId).entityTable('favorite').toArray(), [userId]) ?? [];
  return new Set(rows.map((r) => String(r.exerciseId)));
}

export async function toggleFavorite(userId: string, exerciseId: string) {
  const db = getDB(userId);
  const existing = await db.entityTable('favorite').where('exerciseId').equals(exerciseId).first();
  if (existing) await deleteRecord(db, 'favorite', existing.id);
  else await saveRecord(db, 'favorite', { id: uuidv7(), exerciseId });
  void getSyncEngine(userId).sync();
}

export async function saveOwnExercise(userId: string, exercise: LocalOwnExercise) {
  await saveRecord(getDB(userId), 'exercise', exercise);
  void getSyncEngine(userId).sync();
}

export async function deleteOwnExercise(userId: string, id: string) {
  await deleteRecord(getDB(userId), 'exercise', id);
  void getSyncEngine(userId).sync();
}

export function useCredits(userId: string) {
  return useLiveQuery(async () => (await getDB(userId).meta.get('catalogCredits'))?.value, [userId]) as
    | Array<{ source: string; license: string; url: string; authors: string[]; count: number }>
    | undefined;
}
