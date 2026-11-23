import { fileURLToPath } from 'node:url';

/** Pinned upstream revision: the catalog only changes when this is bumped on purpose. */
export const FEDB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
export const FEDB_BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FEDB_COMMIT}`;
export const WGER_API = 'https://wger.de/api/v2';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CACHE_DIR = `${ROOT}.cache`;
export const OUT_DIR = `${ROOT}out`;
export const TRANSLATIONS_FILE = `${ROOT}translations/es.json`;

/** Image output: small enough for phones, ~25 KB each. */
export const IMAGE_WIDTH = 480;
export const IMAGE_QUALITY = 62;
