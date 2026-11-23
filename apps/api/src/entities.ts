import { LocationSchema, ProfileSchema } from '@gym/shared';
import { locations, profiles } from './db/schema';
import { SyncRegistry, type SyncEntityDef, type SyncTable } from './lib/sync-registry';

/** All synchronizable entities, registered per user story. */
export const ENTITIES: SyncEntityDef[] = [
  // US1
  { name: 'profile', table: profiles as unknown as SyncTable, schema: ProfileSchema, idIsOwnerId: true },
  { name: 'location', table: locations as unknown as SyncTable, schema: LocationSchema },
];

export function createSyncRegistry() {
  return new SyncRegistry(ENTITIES);
}
