/**
 * Builds the base exercise catalog into `out/`:
 *   out/catalog/manifest.json, out/catalog/catalog-<version>.json, out/media/exercises/<id>/<n>.webp
 * Downloads are cached in `.cache/` (pinned upstream commit), so rebuilding is offline and repeatable.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { CatalogExerciseSchema, type CatalogFile, type CatalogManifest } from '@gym/shared';
import { CACHE_DIR, FEDB_BASE, FEDB_COMMIT, IMAGE_QUALITY, IMAGE_WIDTH, IMPORTER_VERSION, OUT_DIR, TRANSLATIONS_FILE, WGER_API } from '../src/config';
import { mergeCatalog, type Translations } from '../src/merge';
import { EQUIPMENT_OVERRIDES, FedbExerciseSchema } from '../src/sources/fedb';
import { WgerExerciseSchema, spanishNamesByEnglish } from '../src/sources/wger';

const FEDB_REPO = 'https://github.com/yuhonas/free-exercise-db';

async function cachedFetch(url: string, file: string): Promise<Buffer> {
  const path = `${CACHE_DIR}/${file}`;
  if (existsSync(path)) return readFile(path);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': 'gym-catalog-builder' } });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
      await writeFile(path, buf);
      return buf;
    }
    if (attempt >= 3) throw new Error(`GET ${url} → ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function loadWger() {
  const all: unknown[] = [];
  let url: string | null = `${WGER_API}/exerciseinfo/?limit=200&offset=0`;
  let page = 0;
  while (url) {
    const body = JSON.parse((await cachedFetch(url, `wger/exerciseinfo-${page}.json`)).toString()) as {
      next: string | null;
      results: unknown[];
    };
    all.push(...body.results);
    url = body.next;
    page += 1;
  }
  return all.map((x) => WgerExerciseSchema.parse(x));
}

async function main() {
  console.log(`free-exercise-db @ ${FEDB_COMMIT.slice(0, 7)}`);
  const fedbRaw = JSON.parse((await cachedFetch(`${FEDB_BASE}/dist/exercises.json`, `fedb-${FEDB_COMMIT}.json`)).toString());
  const fedb = (fedbRaw as unknown[]).map((x) => FedbExerciseSchema.parse(x));
  const wger = await loadWger();
  const wgerNames = spanishNamesByEnglish(wger);
  const translations: Translations = existsSync(TRANSLATIONS_FILE)
    ? JSON.parse(await readFile(TRANSLATIONS_FILE, 'utf8'))
    : {};

  // Version = hash of the inputs that shape the catalog (data, translations, image settings).
  const versionHash = createHash('sha256')
    .update(FEDB_COMMIT)
    .update(JSON.stringify(translations))
    .update(JSON.stringify([...wgerNames.entries()]))
    .update(`${IMAGE_WIDTH}:${IMAGE_QUALITY}:${IMPORTER_VERSION}`)
    .update(JSON.stringify(EQUIPMENT_OVERRIDES))
    .digest('hex');
  const version = parseInt(versionHash.slice(0, 8), 16);

  const exercises = mergeCatalog({ fedb, wgerNames, translations, version, fedbRepoUrl: FEDB_REPO }).map((e) =>
    CatalogExerciseSchema.parse(e),
  );

  // Images → WebP.
  await rm(`${OUT_DIR}/media`, { recursive: true, force: true });
  const limit = pLimit(8);
  let images = 0;
  await Promise.all(
    fedb.flatMap((ex) =>
      ex.images.map((img, i) =>
        limit(async () => {
          const src = await cachedFetch(`${FEDB_BASE}/exercises/${img}`, `fedb-images/${img}`);
          const dir = `${OUT_DIR}/media/exercises/${ex.id}`;
          await mkdir(dir, { recursive: true });
          await sharp(src).resize({ width: IMAGE_WIDTH, withoutEnlargement: true }).webp({ quality: IMAGE_QUALITY }).toFile(`${dir}/${i}.webp`);
          images += 1;
          if (images % 200 === 0) console.log(`  ${images} images`);
        }),
      ),
    ),
  );

  const wgerUsed = exercises.filter((e) => e.license.includes('wger'));
  const catalog: CatalogFile = {
    version,
    generatedAt: new Date().toISOString(),
    exercises,
    credits: [
      { source: 'free-exercise-db', license: 'Unlicense (dominio público)', url: FEDB_REPO, authors: ['free-exercise-db contributors'], count: exercises.length },
      ...(wgerUsed.length
        ? [{ source: 'wger Workout Manager (nombres en español)', license: 'CC-BY-SA 4.0', url: 'https://wger.de', authors: [...new Set(wgerUsed.flatMap((e) => e.authors.slice(1)))], count: wgerUsed.length }]
        : []),
    ],
  };
  const json = JSON.stringify(catalog);
  const file = `catalog-${version}.json`;
  await rm(`${OUT_DIR}/catalog`, { recursive: true, force: true });
  await mkdir(`${OUT_DIR}/catalog`, { recursive: true });
  await writeFile(`${OUT_DIR}/catalog/${file}`, json);
  const manifest: CatalogManifest = {
    version,
    file,
    sha256: createHash('sha256').update(json).digest('hex'),
    sizeBytes: Buffer.byteLength(json),
    exerciseCount: exercises.length,
    imageCount: images,
    translatedCount: exercises.filter((e) => e.translated).length,
  };
  await writeFile(`${OUT_DIR}/catalog/manifest.json`, JSON.stringify(manifest, null, 2));
  console.log(
    `catalog v${version}: ${manifest.exerciseCount} exercises, ${images} images, ` +
      `${manifest.translatedCount} translated, ${wgerUsed.length} Spanish names from wger, ${(manifest.sizeBytes / 1024).toFixed(0)} KB`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
