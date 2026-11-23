/**
 * Rest timer based on an absolute end time, so it survives reloads, backgrounding and locked
 * screens (the remaining time is recomputed from the clock, never counted down in memory).
 */
export interface RestState {
  endsAt: number; // epoch ms
  totalSeconds: number;
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

export function startRest(seconds: number, now = Date.now()): RestState {
  return { endsAt: now + seconds * 1000, totalSeconds: seconds };
}

export function addRest(state: RestState, seconds: number, now = Date.now()): RestState {
  const base = Math.max(state.endsAt, now);
  // Taking time off never moves the end into the past: it just ends now.
  const endsAt = Math.max(now, base + seconds * 1000);
  return { endsAt, totalSeconds: Math.max(0, state.totalSeconds + (endsAt - base) / 1000) };
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
