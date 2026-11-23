import {
  BodyMeasurementSchema,
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
  bodyMeasurements,
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

type Ref = { entity: string; id: string; allowDeleted?: boolean };
/** Optional pointer to another row of the same owner (deleted targets allowed). */
const owned = (entity: string, id: unknown): Ref[] => (typeof id === 'string' && id ? [{ entity, id, allowDeleted: true }] : []);
/** Catalog ids look like "fedb:…"; anything else is one of the user's own exercises. */
const ownExercise = (id: unknown): Ref[] => (typeof id === 'string' && !id.includes(':') ? owned('exercise', id) : []);

/** All synchronizable entities, registered per user story. */
export const ENTITIES: SyncEntityDef[] = [
  // US1
  { name: 'profile', table: profiles as unknown as SyncTable, schema: ProfileSchema, idIsOwnerId: true },
  { name: 'location', table: locations as unknown as SyncTable, schema: LocationSchema },
  // US2
  { name: 'exercise', table: exercises as unknown as SyncTable, schema: OwnExerciseSchema },
  {
    name: 'favorite',
    table: favorites as unknown as SyncTable,
    schema: FavoriteSchema,
    references: (d) => ownExercise(d.exerciseId),
  },
  // US3
  { name: 'program', table: programs as unknown as SyncTable, schema: ProgramSchema },
  {
    name: 'routine',
    table: routines as unknown as SyncTable,
    schema: RoutineSchema,
    references: (d) => [
      ...(d.programId ? [{ entity: 'program', id: String(d.programId) }] : []),
      ...owned('location', d.locationId),
      ...(Array.isArray(d.items) ? d.items.flatMap((i: { exerciseId?: unknown }) => ownExercise(i.exerciseId)) : []),
    ],
  },
  {
    name: 'workoutSession',
    table: workoutSessions as unknown as SyncTable,
    schema: WorkoutSessionSchema,
    references: (d) => [...owned('routine', d.routineId), ...owned('location', d.locationId)],
  },
  {
    name: 'sessionExercise',
    table: sessionExercises as unknown as SyncTable,
    schema: SessionExerciseSchema,
    references: (d) => [
      { entity: 'workoutSession', id: String(d.sessionId) },
      ...ownExercise(d.exerciseId),
      ...ownExercise(d.replacedFromExerciseId),
    ],
  },
  {
    name: 'setEntry',
    table: setEntries as unknown as SyncTable,
    schema: SetEntrySchema,
    references: (d) => [{ entity: 'sessionExercise', id: String(d.sessionExerciseId) }],
  },
  // US5
  { name: 'bodyMeasurement', table: bodyMeasurements as unknown as SyncTable, schema: BodyMeasurementSchema },
];

export function createSyncRegistry() {
  return new SyncRegistry(ENTITIES);
}
