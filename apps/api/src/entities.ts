import { SyncRegistry } from './lib/sync-registry';

/** All synchronizable entities. Each user story registers its entities here. */
export function createSyncRegistry() {
  return new SyncRegistry([]);
}
