import { FavoriteSchema, LocationSchema, OwnExerciseSchema, ProfileSchema } from '@gym/shared';
import { exercises, favorites, locations, profiles } from './db/schema';
import { SyncRegistry, type SyncEntityDef, type SyncTable } from './lib/sync-registry';

/** All synchronizable entities, registered per user story. */
export const ENTITIES: SyncEntityDef[] = [
  // US1
  { name: 'profile', table: profiles as unknown as SyncTable, schema: ProfileSchema, idIsOwnerId: true },
  { name: 'location', table: locations as unknown as SyncTable, schema: LocationSchema },
  // US2
  { name: 'exercise', table: exercises as unknown as SyncTable, schema: OwnExerciseSchema },
  { name: 'favorite', table: favorites as unknown as SyncTable, schema: FavoriteSchema },
];

export function createSyncRegistry() {
  return new SyncRegistry(ENTITIES);
}
