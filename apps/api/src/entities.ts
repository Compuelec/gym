import {
  FavoriteSchema,
  LocationSchema,
  OwnExerciseSchema,
  ProfileSchema,
  ProgramSchema,
  RoutineSchema,
  SessionExerciseSchema,
  SetEntrySchema,
  WorkoutSessionSchema,
} from '@gym/shared';
import {
  exercises,
  favorites,
  locations,
  profiles,
  programs,
  routines,
  sessionExercises,
  setEntries,
  workoutSessions,
} from './db/schema';
import { SyncRegistry, type SyncEntityDef, type SyncTable } from './lib/sync-registry';

/** All synchronizable entities, registered per user story. */
export const ENTITIES: SyncEntityDef[] = [
  // US1
  { name: 'profile', table: profiles as unknown as SyncTable, schema: ProfileSchema, idIsOwnerId: true },
  { name: 'location', table: locations as unknown as SyncTable, schema: LocationSchema },
  // US2
  { name: 'exercise', table: exercises as unknown as SyncTable, schema: OwnExerciseSchema },
  { name: 'favorite', table: favorites as unknown as SyncTable, schema: FavoriteSchema },
  // US3
  { name: 'program', table: programs as unknown as SyncTable, schema: ProgramSchema },
  {
    name: 'routine',
    table: routines as unknown as SyncTable,
    schema: RoutineSchema,
    references: (d) => (d.programId ? [{ entity: 'program', id: String(d.programId) }] : []),
  },
  { name: 'workoutSession', table: workoutSessions as unknown as SyncTable, schema: WorkoutSessionSchema },
  {
    name: 'sessionExercise',
    table: sessionExercises as unknown as SyncTable,
    schema: SessionExerciseSchema,
    references: (d) => [{ entity: 'workoutSession', id: String(d.sessionId) }],
  },
  {
    name: 'setEntry',
    table: setEntries as unknown as SyncTable,
    schema: SetEntrySchema,
    references: (d) => [{ entity: 'sessionExercise', id: String(d.sessionExerciseId) }],
  },
];

export function createSyncRegistry() {
  return new SyncRegistry(ENTITIES);
}
