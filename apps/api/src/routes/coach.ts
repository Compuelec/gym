import { Hono } from 'hono';
import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { CoachRequestBodySchema, uuidv7, type CoachProgram } from '@gym/shared';
import type { Database } from '../db/client';
import { coachRequests, programs, routines } from '../db/schema';
import type { Env } from '../env';
import { availability, getSettings } from '../lib/ai-settings';
import { apiError } from '../lib/errors';
import type { AppVariables } from '../lib/middleware';

const startOfDayUtc = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** Requests that count toward the daily limit (failed ones are free). */
async function usedToday(db: Database, ownerId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(coachRequests)
    .where(and(eq(coachRequests.ownerId, ownerId), gte(coachRequests.createdAt, startOfDayUtc()), ne(coachRequests.status, 'failed')));
  return row?.n ?? 0;
}

function publicRequest(r: typeof coachRequests.$inferSelect) {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    message: (r.messages as Array<{ content: string }>)[0]?.content ?? '',
    result: r.resultJson,
    errorMessage: r.errorMessage,
    accepted: Boolean(r.acceptedAt),
    createdAt: r.createdAt.toISOString(),
  };
}

export function coachRoutes(db: Database, config: Env) {
  return new Hono<{ Variables: AppVariables }>()
    .get('/status', async (c) => {
      const status = availability(await getSettings(db), config);
      return c.json(status.available ? { available: true } : { available: false, reason: status.reason });
    })
    .get('/quota', async (c) => {
      const settings = await getSettings(db);
      const tomorrow = new Date(startOfDayUtc().getTime() + 86_400_000);
      return c.json({ used: await usedToday(db, c.get('user').id), limit: settings.aiDailyLimitPerUser, resetsAt: tomorrow.toISOString() });
    })
    .post('/requests', async (c) => {
      const body = CoachRequestBodySchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return apiError(c, 400, 'VALIDATION');
      const owner = c.get('user').id;
      const settings = await getSettings(db);
      const status = availability(settings, config);
      if (!status.available) return apiError(c, 503, 'INTERNAL', 'El coach no está disponible por ahora.');
      const [busy] = await db
        .select({ id: coachRequests.id })
        .from(coachRequests)
        .where(and(eq(coachRequests.ownerId, owner), inArray(coachRequests.status, ['queued', 'running'])));
      if (busy) return apiError(c, 409, 'CONFLICT', 'Ya tienes una consulta en curso. Espera a que termine.');
      if ((await usedToday(db, owner)) >= settings.aiDailyLimitPerUser) {
        const retryAt = new Date(startOfDayUtc().getTime() + 86_400_000).toISOString();
        return c.json({ error: { code: 'COACH_LIMIT', message: 'Alcanzaste el límite diario del coach.', retryAt } }, 429);
      }
      const busyMessage = 'Ya tienes una consulta en curso. Espera a que termine.';
      // The unique index on in-flight requests settles parallel POSTs: only one gets in.
      const [row] = await db
        .insert(coachRequests)
        .values({ ownerId: owner, kind: body.data.kind, messages: [{ role: 'user', content: body.data.message, locationIds: body.data.locationIds }], status: 'queued' })
        .onConflictDoNothing()
        .returning({ id: coachRequests.id });
      if (!row) return apiError(c, 409, 'CONFLICT', busyMessage);
      return c.json({ id: row.id }, 202);
    })
    .get('/requests', async (c) => {
      const rows = await db.select().from(coachRequests).where(eq(coachRequests.ownerId, c.get('user').id)).orderBy(desc(coachRequests.createdAt)).limit(20);
      return c.json({ requests: rows.map(publicRequest) });
    })
    .get('/requests/:id', async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return apiError(c, 404, 'NOT_FOUND');
      const [row] = await db.select().from(coachRequests).where(and(eq(coachRequests.id, id.data), eq(coachRequests.ownerId, c.get('user').id)));
      if (!row) return apiError(c, 404, 'NOT_FOUND');
      return c.json(publicRequest(row));
    })
    .post('/requests/:id/accept', async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return apiError(c, 404, 'NOT_FOUND');
      const owner = c.get('user').id;
      const [row] = await db.select().from(coachRequests).where(and(eq(coachRequests.id, id.data), eq(coachRequests.ownerId, owner)));
      if (!row || row.kind !== 'program' || row.status !== 'done') return apiError(c, 404, 'NOT_FOUND');
      if (row.acceptedAt) return apiError(c, 409, 'CONFLICT', 'Este programa ya fue aceptado.');
      const program = row.resultJson as CoachProgram;
      const programId = uuidv7();
      const next = sql`nextval('sync_version_seq')`;
      const created = await db.transaction(async (tx) => {
        // Claim the request first: of two concurrent accepts only one finds it unaccepted.
        const [claimed] = await tx
          .update(coachRequests)
          .set({ acceptedAt: sql`now()` })
          .where(and(eq(coachRequests.id, row.id), isNull(coachRequests.acceptedAt)))
          .returning({ id: coachRequests.id });
        if (!claimed) return false;
        await tx.insert(programs).values({
          id: programId,
          ownerId: owner,
          serverVersion: next,
          name: program.name.slice(0, 80),
          weeks: program.weeks,
          source: 'coach',
          coachRequestId: row.id,
          startedAt: new Date().toISOString(),
          summaryEs: program.summaryEs.slice(0, 600),
        });
        for (const day of program.days) {
          await tx.insert(routines).values({
            id: uuidv7(),
            ownerId: owner,
            serverVersion: next,
            name: `${program.name} · ${day.title}`.slice(0, 60),
            programId,
            weekIndex: null,
            dayIndex: day.dayIndex,
            locationId: day.locationId,
            notes: null,
            items: day.items.map((i, position) => ({
              position,
              exerciseId: i.exerciseId,
              supersetGroup: i.supersetGroup,
              targetSets: i.sets,
              repMin: i.repMin,
              repMax: i.repMax,
              targetSeconds: i.seconds,
              targetRir: i.rir,
              restSeconds: i.restSeconds,
              notes: i.noteEs,
            })),
          });
        }
        return true;
      });
      if (!created) return apiError(c, 409, 'CONFLICT', 'Este programa ya fue aceptado.');
      return c.json({ programId, routines: program.days.length });
    });
}
