/**
 * Guards local writes against two real-world failures:
 * - iOS 26 can hang the first IndexedDB readwrite transaction after a push subscription
 *   (WebKit bug 315804): we time out and retry once.
 * - A full device (`QuotaExceededError`): we free space by evicting cached catalog images, never
 *   the outbox or workout data, then retry once.
 */
export class WriteTimeoutError extends Error {
  constructor() {
    super('Local write timed out');
    this.name = 'WriteTimeoutError';
  }
}

export interface SafeWriteOptions {
  timeoutMs?: number;
  onQuotaExceeded?: () => Promise<void>;
  onStorageFull?: () => void;
}

export async function safeWrite<T>(write: () => Promise<T>, options: SafeWriteOptions = {}): Promise<T> {
  const { timeoutMs = 5000, onQuotaExceeded = evictCatalogImages, onStorageFull } = options;
  try {
    return await withTimeout(write, timeoutMs);
  } catch (err) {
    if (err instanceof WriteTimeoutError) return withTimeout(write, timeoutMs);
    if (isQuotaExceeded(err)) {
      onStorageFull?.();
      await onQuotaExceeded();
      return withTimeout(write, timeoutMs);
    }
    throw err;
  }
}

function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new WriteTimeoutError()), ms);
    fn().then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export function isQuotaExceeded(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  const inner = (err as { inner?: { name?: string } }).inner?.name; // Dexie wraps DOMExceptions
  return name === 'QuotaExceededError' || inner === 'QuotaExceededError';
}

export const CATALOG_IMAGE_CACHE = 'catalog-images';

/** Frees space by dropping cached catalog images (they can be downloaded again). */
export async function evictCatalogImages() {
  if (typeof caches !== 'undefined') await caches.delete(CATALOG_IMAGE_CACHE);
}
