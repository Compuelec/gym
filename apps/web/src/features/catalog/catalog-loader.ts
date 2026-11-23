import { CatalogFileSchema, CatalogManifestSchema, type CatalogExercise } from '@gym/shared';
import type { GymDB } from '@/db/database';
import { safeWrite } from '@/db/safe-write';

const VERSION_KEY = 'catalogVersion';
const IMAGES_KEY = 'catalogImagesVersion';

export interface CatalogLoadResult {
  status: 'up_to_date' | 'updated' | 'offline';
  version: number | null;
}

/**
 * Downloads the base catalog when the server has a new version and replaces it locally in one
 * transaction. Exercises that disappeared upstream are kept with `retiredAt` (history and routines
 * still show them; search hides them).
 */
export async function ensureCatalog(db: GymDB, fetcher: typeof fetch = fetch): Promise<CatalogLoadResult> {
  const local = (await db.meta.get(VERSION_KEY))?.value as number | undefined;
  let manifest;
  try {
    const res = await fetcher('/catalog/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`manifest ${res.status}`);
    manifest = CatalogManifestSchema.parse(await res.json());
  } catch {
    return { status: 'offline', version: local ?? null };
  }
  if (manifest.version === local) return { status: 'up_to_date', version: local };

  const res = await fetcher(`/catalog/${manifest.file}`);
  if (!res.ok) return { status: 'offline', version: local ?? null };
  const file = CatalogFileSchema.parse(await res.json());
  const table = db.table<CatalogExercise, string>('catalog');
  const now = new Date().toISOString();

  await safeWrite(() =>
    db.transaction('rw', table, db.meta, async () => {
      const incoming = new Set(file.exercises.map((e) => e.id));
      const previous = await table.toArray();
      const retired = previous
        .filter((e) => !incoming.has(e.id) && !e.retiredAt)
        .map((e) => ({ ...e, retiredAt: now }));
      await table.bulkPut([...file.exercises, ...retired]);
      await db.meta.put({ key: VERSION_KEY, value: file.version });
      await db.meta.put({ key: 'catalogCredits', value: file.credits });
    }),
  );
  return { status: 'updated', version: file.version };
}

/**
 * Warms the image cache so the whole catalog works offline (the service worker stores each
 * /media request). Runs in the background with low concurrency, once per catalog version.
 */
export async function precacheCatalogImages(db: GymDB, fetcher: typeof fetch = fetch, concurrency = 4) {
  const version = (await db.meta.get(VERSION_KEY))?.value;
  if (!version || (await db.meta.get(IMAGES_KEY))?.value === version) return 0;
  const urls = (await db.table<CatalogExercise, string>('catalog').toArray())
    .filter((e) => !e.retiredAt)
    .flatMap((e) => e.media.filter((m) => m.type === 'image').map((m) => m.url));
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++]!;
      try {
        const res = await fetcher(url);
        if (res.ok) done += 1;
      } catch {
        return; // offline: try again next time
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  if (done === urls.length) await db.meta.put({ key: IMAGES_KEY, value: version });
  return done;
}

/** True when running as an installed app (home screen), where the full offline catalog applies. */
export function isInstalledApp(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * In the installed app, warm every image once the device is idle (FR-011). In a browser tab,
 * images are cached as they are viewed, so a casual visit never downloads 20+ MB.
 */
export function scheduleImagePrecache(db: GymDB) {
  if (!isInstalledApp()) return;
  const run = () => void precacheCatalogImages(db);
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 10_000 });
  else setTimeout(run, 5_000);
}
