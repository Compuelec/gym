import { and, eq, isNull, sql } from 'drizzle-orm';
import { uuidv7 } from '@gym/shared';
import { z } from 'zod';
import type { Database } from '../db/client';
import { account, invitations, pushSubscriptions, scheduledPushes, session as sessionTable, syncMutations, user } from '../db/schema';
import type { SyncRegistry } from './sync-registry';

export const EXPORT_FORMAT_VERSION = 1;
const META = new Set(['ownerId', 'serverVersion', 'deletedAt', 'createdAt', 'updatedAt']);

type Row = Record<string, unknown> & { id: string };

/** Entities exported flat, then sessions nested (session → exercises → sets) for readability. */
const FLAT = ['profile', 'location', 'exercise', 'favorite', 'program', 'routine', 'bodyMeasurement'] as const;

function clean(row: Record<string, unknown>): Row {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([k]) => !META.has(k))
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  ) as Row;
}

async function rowsOf(db: Database, registry: SyncRegistry, entity: string, ownerId: string): Promise<Row[]> {
  const def = registry.get(entity);
  if (!def) return [];
  const rows = await db.select().from(def.table).where(and(eq(def.table.ownerId, ownerId), isNull(def.table.deletedAt)));
  return rows.map((r) => {
    const row = clean(r as Record<string, unknown>);
    // Timestamp strings from Postgres → ISO.
    for (const [k, v] of Object.entries(row)) if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(v)) row[k] = new Date(v).toISOString();
    return row;
  });
}

/** Everything the user owns, in an open, versioned JSON format. */
export async function exportUserData(db: Database, registry: SyncRegistry, ownerId: string) {
  const flat = Object.fromEntries(await Promise.all(FLAT.map(async (e) => [e, await rowsOf(db, registry, e, ownerId)] as const)));
  const sessions = await rowsOf(db, registry, 'workoutSession', ownerId);
  const sessionExercises = await rowsOf(db, registry, 'sessionExercise', ownerId);
  const sets = await rowsOf(db, registry, 'setEntry', ownerId);
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'gym',
    profile: flat.profile?.[0] ?? null,
    locations: flat.location,
    exercises: flat.exercise,
    favorites: flat.favorite,
    programs: flat.program,
    routines: flat.routine,
    measurements: flat.bodyMeasurement,
    sessions: sessions.map((s) => ({
      ...s,
      exercises: sessionExercises
        .filter((se) => se.sessionId === s.id)
        .map((se) => ({ ...se, sets: sets.filter((st) => st.sessionExerciseId === se.id) })),
    })),
  };
}

const AnyRow = z.record(z.string(), z.unknown()).and(z.object({ id: z.string() }));
export const ImportFileSchema = z.object({
  formatVersion: z.literal(EXPORT_FORMAT_VERSION),
  profile: AnyRow.nullable(),
  locations: z.array(AnyRow),
  exercises: z.array(AnyRow),
  favorites: z.array(AnyRow),
  programs: z.array(AnyRow),
  routines: z.array(AnyRow),
  measurements: z.array(AnyRow),
  sessions: z.array(
    AnyRow.and(z.object({ exercises: z.array(AnyRow.and(z.object({ sets: z.array(AnyRow) }))) })),
  ),
});

export class ImportError extends Error {}

/**
 * Imports an export into `ownerId`'s account in ONE transaction (all or nothing). Every id is
 * replaced by a new one and every reference is remapped, so importing into any account never
 * collides with other users' data.
 */
export async function importUserData(db: Database, registry: SyncRegistry, ownerId: string, raw: unknown) {
  const parsed = ImportFileSchema.safeParse(raw);
  if (!parsed.success) throw new ImportError('Archivo de exportación no válido o de otra versión.');
  const file = parsed.data;
  const ids = new Map<string, string>();
  const newId = (old: unknown) => {
    if (typeof old !== 'string') return old;
    if (!ids.has(old)) ids.set(old, uuidv7());
    return ids.get(old)!;
  };
  // Own exercise ids are remapped; catalog ids ("fedb:…") stay as they are.
  const ownExercise = new Set(file.exercises.map((e) => String(e.id)));
  const exRef = (id: unknown) => (typeof id === 'string' && ownExercise.has(id) ? newId(id) : id);
  const ref = (id: unknown) => (id == null ? null : newId(id));

  const plan: Array<{ entity: string; id: string; data: Record<string, unknown> }> = [];
  const add = (entity: string, row: Record<string, unknown>, id: string) => {
    const { id: _old, exercises: _e, sets: _s, ...data } = row;
    plan.push({ entity, id, data });
  };
  if (file.profile) add('profile', file.profile, ownerId);
  for (const r of file.locations) add('location', r, newId(r.id) as string);
  for (const r of file.exercises) add('exercise', r, newId(r.id) as string);
  for (const r of file.favorites) add('favorite', { ...r, exerciseId: exRef(r.exerciseId) }, newId(r.id) as string);
  for (const r of file.programs) add('program', r, newId(r.id) as string);
  for (const r of file.routines) {
    const items = Array.isArray(r.items) ? r.items.map((i: Record<string, unknown>) => ({ ...i, exerciseId: exRef(i.exerciseId) })) : r.items;
    add('routine', { ...r, items, programId: ref(r.programId), locationId: ref(r.locationId) }, newId(r.id) as string);
  }
  for (const r of file.measurements) add('bodyMeasurement', r, newId(r.id) as string);
  for (const s of file.sessions) {
    const sid = newId(s.id) as string;
    add('workoutSession', { ...s, routineId: ref(s.routineId), locationId: ref(s.locationId) }, sid);
    for (const se of s.exercises) {
      const seid = newId(se.id) as string;
      add('sessionExercise', { ...se, sessionId: sid, exerciseId: exRef(se.exerciseId), replacedFromExerciseId: exRef(se.replacedFromExerciseId) ?? null }, seid);
      for (const st of se.sets) add('setEntry', { ...st, sessionExerciseId: seid }, newId(st.id) as string);
    }
  }

  await db.transaction(async (tx) => {
    for (const item of plan) {
      const def = registry.get(item.entity);
      if (!def) throw new ImportError(`Tipo de dato desconocido: ${item.entity}`);
      const valid = def.schema.safeParse(item.data);
      if (!valid.success) throw new ImportError(`Datos no válidos en ${item.entity}.`);
      const values = { ...valid.data, id: item.id, ownerId, serverVersion: sql`nextval('sync_version_seq')` };
      await tx
        .insert(def.table)
        .values(values)
        .onConflictDoUpdate({ target: def.table.id, set: { ...valid.data, deletedAt: null, updatedAt: sql`now()`, serverVersion: sql`nextval('sync_version_seq')` } });
    }
  });
  return { imported: plan.length };
}

/** Removes every row owned by the user and the user itself (sessions/accounts cascade). */
export async function deleteUserData(db: Database, registry: SyncRegistry, ownerId: string) {
  await db.transaction(async (tx) => {
    for (const def of registry.all()) await tx.delete(def.table).where(eq(def.table.ownerId, ownerId));
    await tx.delete(syncMutations).where(eq(syncMutations.ownerId, ownerId));
    await tx.delete(scheduledPushes).where(eq(scheduledPushes.ownerId, ownerId));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.ownerId, ownerId));
    // Keep the invitation row for auditing, without personal data.
    await tx.update(invitations).set({ usedBy: null, usedEmail: null }).where(eq(invitations.usedBy, ownerId));
    await tx.delete(user).where(eq(user.id, ownerId));
  });
}

export async function credentialHash(db: Database, ownerId: string) {
  const [row] = await db
    .select({ password: account.password })
    .from(account)
    .where(and(eq(account.userId, ownerId), eq(account.providerId, 'credential')));
  return row?.password ?? null;
}

export async function sessionCreatedAt(db: Database, token: string | undefined) {
  if (!token) return null;
  const [row] = await db.select({ createdAt: sessionTable.createdAt }).from(sessionTable).where(eq(sessionTable.token, token));
  return row?.createdAt ?? null;
}
