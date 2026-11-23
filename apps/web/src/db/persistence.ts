/**
 * Asks the browser to keep local data even under storage pressure. WebKit grants it by heuristics
 * (e.g. when installed to the home screen), Chromium when the site is engaged/installed.
 * Data loss is still survivable: the server is the source of truth and an empty local database
 * pulls everything again from cursor 0.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
