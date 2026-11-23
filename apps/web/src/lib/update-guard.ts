/**
 * Decides whether a new app version may be applied now. Features register blockers (e.g. a
 * workout session in progress) so an update never reloads the app mid-workout.
 */
type Blocker = () => boolean | Promise<boolean>;

const blockers = new Set<Blocker>();

export function registerUpdateBlocker(isBlocking: Blocker): () => void {
  blockers.add(isBlocking);
  return () => blockers.delete(isBlocking);
}

export async function canApplyUpdateNow(): Promise<boolean> {
  for (const isBlocking of blockers) {
    if (await isBlocking()) return false;
  }
  return true;
}

/**
 * Resolves once nothing blocks an update (checked every `intervalMs`), so an update the user
 * accepted during a workout is applied as soon as the workout ends. `stop` cancels the wait.
 */
export function whenUpdateAllowed(intervalMs = 5000): { done: Promise<void>; stop: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const done = new Promise<void>((resolve) => {
    const check = async () => {
      if (stopped) return;
      if (await canApplyUpdateNow()) return resolve();
      timer = setTimeout(() => void check(), intervalMs);
    };
    void check();
  });
  return {
    done,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
