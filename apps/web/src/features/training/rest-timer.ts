/**
 * Rest timer based on an absolute end time, so it survives reloads, backgrounding and locked
 * screens (the remaining time is recomputed from the clock, never counted down in memory).
 */
export interface RestState {
  endsAt: number; // epoch ms
  totalSeconds: number;
  next?: string; // what comes after the rest («Serie 2 de 3 · Remo»), shown in the alerts
}

export function remainingSeconds(state: RestState | null, now = Date.now()): number {
  if (!state) return 0;
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}

/** Seconds past the end (shown as «+0:12» when the user comes back late). */
export function overtimeSeconds(state: RestState | null, now = Date.now()): number {
  if (!state) return 0;
  return Math.max(0, Math.floor((now - state.endsAt) / 1000));
}

export function startRest(seconds: number, now = Date.now(), next?: string): RestState {
  return { endsAt: now + seconds * 1000, totalSeconds: seconds, ...(next ? { next } : {}) };
}

export function addRest(state: RestState, seconds: number, now = Date.now()): RestState {
  const base = Math.max(state.endsAt, now);
  // Taking time off never moves the end into the past: it just ends now.
  const endsAt = Math.max(now, base + seconds * 1000);
  return { ...state, endsAt, totalSeconds: Math.max(0, state.totalSeconds + (endsAt - base) / 1000) };
}

export function formatClock(totalSeconds: number): string {
  // An hour or more: h:mm:ss («1:05:09»), never «65:09».
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const key = (sessionId: string) => `gym.rest.${sessionId}`;

export function saveRest(sessionId: string, state: RestState | null, storage: Storage = localStorage) {
  try {
    if (state) storage.setItem(key(sessionId), JSON.stringify(state));
    else storage.removeItem(key(sessionId));
  } catch {
    // Storage unavailable: the timer still works for this page view.
  }
}

export function loadRest(sessionId: string, storage: Storage = localStorage): RestState | null {
  try {
    const raw = storage.getItem(key(sessionId));
    return raw ? (JSON.parse(raw) as RestState) : null;
  } catch {
    return null;
  }
}

/** Seconds before the end of a rest when the «get ready» alert fires. */
export const REST_WARNING_SECONDS = 10;

/**
 * What comes after a set: the next set of the same exercise, or the next exercise still pending.
 * `done` counts the sets of each exercise including the one just logged.
 */
export function nextUp(
  items: Array<{ id: string; name: string; targetSets: number | null; done: number }>,
  currentId: string,
): string {
  const i = items.findIndex((x) => x.id === currentId);
  const cur = items[i];
  if (cur && cur.targetSets && cur.done < cur.targetSets) return `Serie ${cur.done + 1} de ${cur.targetSets} · ${cur.name}`;
  const pending = [...items.slice(i + 1), ...items.slice(0, Math.max(0, i))].find((x) => x.id !== currentId && (!x.targetSets || x.done < x.targetSets));
  return pending ? `Siguiente ejercicio: ${pending.name}` : 'Última serie hecha: termina cuando quieras';
}
