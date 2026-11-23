import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { MUSCLES, fitsEquipment, type CatalogExercise } from '@gym/shared';
import type { Database } from '../db/client';
import { goalPlan } from '@gym/engine';
import {
  bodyMeasurements,
  exercises,
  locations,
  profiles,
  routines,
  sessionExercises,
  setEntries,
  workoutSessions,
} from '../db/schema';
import type { CatalogEntry } from './coach-validate';

/** At most this many own exercises are offered to the coach (most recently edited first). */
export const MAX_OWN_EXERCISES = 50;

const muscleEs = new Map<string, string>(MUSCLES.map((m) => [m.slug, m.nameEs]));

export interface CoachContext {
  profile: typeof profiles.$inferSelect;
  locations: Array<typeof locations.$inferSelect>;
  catalogLines: string; // stable, cacheable block (base catalog only)
  ownLines: string; // the user's own exercises (user turn)
  catalogMap: Map<string, CatalogEntry>;
  historyText: string;
  bodyText: string; // goal + weight trend (health data: sent to the AI, never logged)
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

  const toCandidate = (e: (typeof own)[number] | CatalogExercise) => ({
    id: e.id,
    nameEs: e.nameEs,
    primary: e.primaryMuscles,
    equipment: e.equipment,
    level: e.level,
    mechanic: e.mechanic,
    category: e.category,
    measure: e.measure,
  });
  const equipment = chosen.map((l) => l.equipment);
  // The base catalog is the same for everyone with the same equipment: a stable, cacheable block.
  const base = formatCatalog(catalog.map(toCandidate), equipment);
  // The user's own exercises are user text: they go in the user turn, capped, never in the
  // instructions (keeps the cost bounded and the system prompt free of user content).
  const mine = formatCatalog(
    [...own].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, MAX_OWN_EXERCISES).map(toCandidate),
    equipment,
  );
  const catalogLines = base.catalogLines;
  const ownLines = mine.catalogLines;
  const catalogMap = new Map([...base.catalogMap, ...mine.catalogMap]);

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
    ownLines,
    catalogMap,
    historyText: [
      ...(lines.length ? lines : ['Sin entrenamientos en las últimas 4 semanas.']),
      ...(routineText.length ? ['Rutinas:', ...routineText] : []),
    ].join('\n'),
    bodyText: await bodyTextOf(db, ownerId, profile),
    routineIds: new Set(userRoutines.map((r) => r.id)),
  };
}

const ACTIVITY_ES: Record<string, string> = { sedentary: 'sedentaria', light: 'ligera', moderate: 'moderada', high: 'alta' };
const SEX_ES: Record<string, string> = { female: 'mujer', male: 'hombre', other: 'otro' };

/** Body data and goal, plus the weight entries of the last 12 weeks (oldest first). */
async function bodyTextOf(db: Database, ownerId: string, p: typeof profiles.$inferSelect, now = new Date()) {
  const since = new Date(now.getTime() - 84 * 86_400_000).toISOString();
  const rows = await db
    .select({ at: bodyMeasurements.measuredAt, kg: bodyMeasurements.weightKg, waist: bodyMeasurements.waistCm, fat: bodyMeasurements.bodyFatPct })
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.ownerId, ownerId), isNull(bodyMeasurements.deletedAt), gte(bodyMeasurements.measuredAt, since)))
    .orderBy(bodyMeasurements.measuredAt);
  const weights = rows.filter((r) => r.kg != null);
  const current = weights.at(-1)?.kg ?? p.bodyweightKg ?? null;
  const age = p.birthYear ? now.getUTCFullYear() - p.birthYear : null;
  const facts = [
    age ? `${age} años` : null,
    p.sex ? SEX_ES[p.sex] : null,
    p.heightCm ? `${p.heightCm} cm` : null,
    current ? `${current} kg` : null,
    p.activityLevel ? `actividad diaria ${ACTIVITY_ES[p.activityLevel]}` : null,
  ].filter(Boolean);
  const out: string[] = [];
  if (facts.length) out.push(`Datos corporales: ${facts.join(', ')}.`);
  if (p.injuries) out.push(`Lesiones o limitaciones (texto del usuario): ${p.injuries}`);
  if (p.targetWeightKg) {
    const plan = goalPlan({ weightKg: current, heightCm: p.heightCm, targetWeightKg: p.targetWeightKg, targetDate: p.targetDate, now: now.getTime() });
    out.push(`Objetivo de peso: ${p.targetWeightKg} kg${p.targetDate ? ` para el ${p.targetDate}` : ''}. ${plan.message}`);
  }
  if (weights.length) {
    out.push(`Registros de peso (12 semanas): ${weights.map((w) => `${w.at.slice(0, 10)} ${w.kg} kg${w.waist ? ` cintura ${w.waist} cm` : ''}`).join('; ')}`);
  }
  return out.join('\n');
}

export function profileText(ctx: CoachContext) {
  const p = ctx.profile;
  const places = ctx.locations
    .map(
      (l) =>
        JSON.stringify({ locationId: l.id, nombre: l.name, equipo: l.equipment.join(',') || 'sin equipo' }),
    )
    .join('\n');
  const own = ctx.ownLines ? `\nEjercicios propios del usuario (mismo formato que el catálogo):\n${ctx.ownLines}` : '';
  const body = ctx.bodyText ? `\n${ctx.bodyText}` : '';
  return `Perfil: objetivo ${p.goal}, nivel ${p.level}, ${p.daysPerWeek} días por semana, ${p.sessionMinutes} minutos por sesión.${body}\nLugares:\n${places}${own}`;
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
