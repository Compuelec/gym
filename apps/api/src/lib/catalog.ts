import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CatalogFileSchema, CatalogManifestSchema, type CatalogExercise } from '@gym/shared';
import type { Env } from '../env';

const DEFAULT_DIR = fileURLToPath(new URL('../../../../packages/catalog/out/catalog', import.meta.url));
let cache: { version: number; exercises: CatalogExercise[] } | undefined;

/** The base catalog on the server (same file the PWA downloads), loaded once per version. */
export async function loadCatalog(config: Env): Promise<CatalogExercise[]> {
  const dir = config.CATALOG_DIR ?? DEFAULT_DIR;
  const manifest = CatalogManifestSchema.parse(JSON.parse(await readFile(`${dir}/manifest.json`, 'utf8')));
  if (cache?.version !== manifest.version) {
    const file = CatalogFileSchema.parse(JSON.parse(await readFile(`${dir}/${manifest.file}`, 'utf8')));
    cache = { version: file.version, exercises: file.exercises.filter((e) => !e.retiredAt) };
  }
  return cache.exercises;
}

export function resetCatalogCache() {
  cache = undefined;
}
