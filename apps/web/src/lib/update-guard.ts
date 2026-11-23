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
