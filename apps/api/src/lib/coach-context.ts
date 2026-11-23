import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { MUSCLES, fitsEquipment, type CatalogExercise } from '@gym/shared';
import type { Database } from '../db/client';
import {
  exercises,
  locations,
  profiles,
  routines,
  sessionExercises,
  setEntries,
  workoutSessions,
} from '../db/schema';
import type { CatalogEntry } from './coach-validate';

const muscleEs = new Map<string, string>(MUSCLES.map((m) => [m.slug, m.nameEs]));

export interface CoachContext {
  profile: typeof profiles.$inferSelect;
  locations: Array<typeof locations.$inferSelect>;
  catalogLines: string; // stable, cacheable block
  catalogMap: Map<string, CatalogEntry>;
  historyText: string;
  routineIds: Set<string>;
}

/**
 * Everything the coach needs, from the user's own data only. The catalog is filtered to what the
 * chosen locations can do and written compactly (id|nombre|músculos|equipo|nivel|mecánica).
 */
export async function buildContext(
  db: Database,
  ownerId: string,
  catalog: CatalogExercise[],
  locationIds?: string[],
): Promise<CoachContext> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.ownerId, ownerId), isNull(profiles.deletedAt)));
  if (!profile) throw new Error('NO_PROFILE');
  const allLocations = await db
    .select()
    .from(locations)
    .where(and(eq(locations.ownerId, ownerId), isNull(locations.deletedAt)));
  const chosen = locationIds?.length
    ? allLocations.filter((l) => locationIds.includes(l.id))
    : allLocations;
  const own = await db
    .select()
    .from(exercises)
    .where(and(eq(exercises.ownerId, ownerId), isNull(exercises.deletedAt)));

  const { catalogLines, catalogMap } = formatCatalog(
    [
      ...catalog.map((e) => ({
        id: e.id,
        nameEs: e.nameEs,
        primary: e.primaryMuscles,
        equipment: e.equipment,
        level: e.level,
        mechanic: e.mechanic,
        category: e.category,
        measure: e.measure,
      })),
      ...own.map((e) => ({
        id: e.id,
        nameEs: e.nameEs,
        primary: e.primaryMuscles,
        equipment: e.equipment,
        level: e.level,
        mechanic: e.mechanic,
        category: e.category,
        measure: e.measure,
      })),
    ],
    chosen.map((l) => l.equipment),
  );

  // Last 4 weeks, compact.
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString();
  const sessions = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.ownerId, ownerId),
        eq(workoutSessions.status, 'completed'),
        gte(workoutSessions.startedAt, since),
      ),
    )
    .orderBy(desc(workoutSessions.startedAt))
    .limit(20);
  const lines: string[] = [];
  for (const s of sessions) {
    const ses = await db
      .select()
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, s.id));
    const parts: string[] = [];
    for (const se of ses) {
      const sets = await db
        .select()
        .from(setEntries)
        .where(and(eq(setEntries.sessionExerciseId, se.id), isNull(setEntries.deletedAt)));
      parts.push(
        `${se.exerciseId}: ${sets.map((x) => (x.weightKg ? `${x.weightKg}kg×${x.reps}` : x.seconds ? `${x.seconds}s` : `${x.reps}`)).join(', ')}`,
      );
    }
    lines.push(
      `${s.startedAt.slice(0, 10)} ${s.name} (esfuerzo ${s.perceivedEffort ?? '-'}): ${parts.join(' | ')}`,
    );
  }
  const userRoutines = await db
    .select()
    .from(routines)
    .where(and(eq(routines.ownerId, ownerId), isNull(routines.deletedAt)));
  const routineText = userRoutines.map(
    (r) =>
      `${r.id} «${r.name}»: ${(r.items as Array<{ exerciseId: string; targetSets: number }>).map((i) => `${i.exerciseId}×${i.targetSets}`).join(', ')}`,
  );

  return {
    profile,
    locations: chosen,
    catalogLines,
    catalogMap,
    historyText: [
      ...(lines.length ? lines : ['Sin entrenamientos en las últimas 4 semanas.']),
      ...(routineText.length ? ['Rutinas:', ...routineText] : []),
    ].join('\n'),
    routineIds: new Set(userRoutines.map((r) => r.id)),
  };
}

export function profileText(ctx: CoachContext) {
  const p = ctx.profile;
  const places = ctx.locations
    .map(
      (l) =>
        `{"locationId":"${l.id}","nombre":"${l.name}","equipo":"${l.equipment.join(',') || 'sin equipo'}"}`,
    )
    .join('\n');
  return `Perfil: objetivo ${p.goal}, nivel ${p.level}, ${p.daysPerWeek} días por semana, ${p.sessionMinutes} minutos por sesión.\nLugares:\n${places}`;
}

export interface CatalogCandidate {
  id: string;
  nameEs: string;
  primary: readonly string[];
  equipment: readonly string[];
  level: string;
  mechanic: string | null;
  category: string;
  measure: string;
}

/** Keeps what the locations can do and writes it compactly (id|nombre|músculos|equipo|nivel|mecánica|medida). */
export function formatCatalog(
  candidates: CatalogCandidate[],
  locationEquipment: Array<readonly string[]>,
) {
  const usable = candidates.filter(
    (c) =>
      ['strength', 'powerlifting', 'plyometrics', 'stretching', 'cardio'].includes(c.category) &&
      locationEquipment.some((eq) => fitsEquipment(c.equipment, eq)),
  );
  const catalogLines = usable
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (c) =>
        `${c.id}|${c.nameEs}|${c.primary.map((m) => muscleEs.get(m) ?? m).join(',')}|${c.equipment.join(',') || 'sin equipo'}|${c.level}|${c.mechanic ?? '-'}|${c.measure}`,
    )
    .join('\n');
  const catalogMap = new Map<string, CatalogEntry>(
    usable.map((c) => [c.id, { id: c.id, equipment: c.equipment }]),
  );
  return { catalogLines, catalogMap };
}
