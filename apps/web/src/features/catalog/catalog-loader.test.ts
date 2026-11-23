import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uuidv7, type CatalogExercise, type CatalogFile } from '@gym/shared';
import { GymDB } from '@/db/database';
import { vi } from 'vitest';
import { ensureCatalog, precacheCatalogImages, scheduleImagePrecache } from './catalog-loader';

const exercise = (id: string, nameEs: string): CatalogExercise => ({
  id: `fedb:${id}`,
  nameEs,
  nameEn: nameEs,
  instructionsEs: ['Paso'],
  translated: true,
  primaryMuscles: ['chest'],
  secondaryMuscles: [],
  equipment: [],
  level: 'beginner',
  category: 'strength',
  mechanic: null,
  force: null,
  measure: 'reps',
  media: [{ type: 'image', url: `/media/exercises/${id}/0.webp`, author: null, license: 'Unlicense', sourceUrl: null }],
  source: 'free-exercise-db',
  license: 'Unlicense',
  authors: [],
  sourceUrl: null,
  catalogVersion: 1,
  retiredAt: null,
});

function server(version: number, exercises: CatalogExercise[]) {
  const file: CatalogFile = { version, generatedAt: '2026-01-01T00:00:00Z', exercises, credits: [] };
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(url);
    if (url === '/catalog/manifest.json')
      return Response.json({ version, file: `catalog-${version}.json`, sha256: 'x', sizeBytes: 1, exerciseCount: exercises.length, imageCount: 1, translatedCount: 1 });
    if (url.startsWith('/catalog/')) return Response.json(file);
    return new Response('img');
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

let db: GymDB;
beforeEach(() => {
  db = new GymDB(`cat-${uuidv7()}`);
});
afterEach(() => db.delete());

describe('ensureCatalog', () => {
  it('downloads the catalog the first time and skips it when unchanged', async () => {
    const s = server(1, [exercise('A', 'Flexiones')]);
    expect(await ensureCatalog(db, s.fetcher)).toEqual({ status: 'updated', version: 1 });
    expect(await db.table('catalog').count()).toBe(1);
    expect(await ensureCatalog(db, s.fetcher)).toEqual({ status: 'up_to_date', version: 1 });
    expect(s.calls.filter((c) => c.endsWith('catalog-1.json'))).toHaveLength(1);
  });

  it('keeps exercises removed upstream as retired, never deletes them', async () => {
    await ensureCatalog(db, server(1, [exercise('A', 'Flexiones'), exercise('B', 'Remo')]).fetcher);
    await ensureCatalog(db, server(2, [exercise('A', 'Flexiones de brazos')]).fetcher);
    const b = (await db.table('catalog').get('fedb:B')) as CatalogExercise;
    expect(b.retiredAt).toBeTruthy();
    expect(((await db.table('catalog').get('fedb:A')) as CatalogExercise).nameEs).toBe('Flexiones de brazos');
  });

  it('works offline with what is already stored', async () => {
    await ensureCatalog(db, server(1, [exercise('A', 'Flexiones')]).fetcher);
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    expect(await ensureCatalog(db, offline)).toEqual({ status: 'offline', version: 1 });
    expect(await db.table('catalog').count()).toBe(1);
  });

  it('is not part of the synced entities', () => {
    expect(db.entityNames()).not.toContain('catalog');
  });
});

describe('precacheCatalogImages', () => {
  it('fetches every image once per version', async () => {
    const s = server(1, [exercise('A', 'Flexiones'), exercise('B', 'Remo')]);
    await ensureCatalog(db, s.fetcher);
    expect(await precacheCatalogImages(db, s.fetcher)).toBe(2);
    expect(await precacheCatalogImages(db, s.fetcher)).toBe(0);
  });
});

describe('scheduleImagePrecache', () => {
  it('does not download every image in a plain browser tab (only the installed app does)', async () => {
    const s = server(1, [exercise('A', 'Flexiones')]);
    await ensureCatalog(db, s.fetcher);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const spy = vi.spyOn(window, 'setTimeout');
    scheduleImagePrecache(db);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
