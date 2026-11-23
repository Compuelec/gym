import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client';
import { bodyMeasurements, coachRequests, notificationLog, profiles, pushSubscriptions, scheduledPushes, workoutSessions } from '../db/schema';
import type { Env } from '../env';
import { availability, getSettings } from './ai-settings';

/** Local calendar facts of an instant in a time zone (weekday 0 = Sunday). */
export function localParts(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday!);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** A reminder is sent within this window after the chosen time (the worker may have been down). */
export const REMINDER_WINDOW_MIN = 90;
/** Weekly summary: Sunday from 19:00 local time until midnight. */
export const SUMMARY_FROM_MIN = 19 * 60;

/** Claims the (person, kind, local day) slot: true only the first time, so nothing is sent twice. */
async function claimSlot(db: Database, ownerId: string, kind: string, localDate: string) {
  const rows = await db.insert(notificationLog).values({ ownerId, kind, localDate }).onConflictDoNothing().returning({ k: notificationLog.kind });
  return rows.length > 0;
}

/**
 * Daily notifications, run by the worker every minute: the training reminder on the chosen days
 * (skipped when the person already trained that local day) and the Sunday weekly summary, which
 * also queues the automatic AI progress review when the AI is on. Only people with a push
 * subscription and a time zone are considered; each row is enqueued in scheduled_pushes and the
 * regular sender delivers it.
 */
export async function enqueueDailyNotifications(db: Database, config: Env, now = new Date()) {
  const candidates = await db
    .select()
    .from(profiles)
    .where(
      and(
        isNull(profiles.deletedAt),
        sql`${profiles.timeZone} is not null`,
        sql`((${profiles.reminderTime} is not null and cardinality(${profiles.reminderDays}) > 0) or ${profiles.weeklySummary} = true)`,
        inArray(profiles.ownerId, db.select({ o: pushSubscriptions.ownerId }).from(pushSubscriptions)),
      ),
    );
  let reminders = 0;
  let summaries = 0;
  for (const p of candidates) {
    const local = localParts(now, p.timeZone!);
    if (p.reminderTime && p.reminderDays?.includes(local.weekday)) {
      const start = toMinutes(p.reminderTime);
      if (local.minutes >= start && local.minutes < start + REMINDER_WINDOW_MIN) {
        if (!(await trainedOn(db, p.ownerId, p.timeZone!, local.date, now)) && (await claimSlot(db, p.ownerId, 'reminder', local.date))) {
          await db.insert(scheduledPushes).values({
            ownerId: p.ownerId,
            kind: 'reminder',
            fireAt: now,
            title: '¿Entrenamos hoy?',
            body: `Hoy te toca entrenar. Tu rutina de ${p.sessionMinutes} minutos está lista.`,
            url: '/today',
          });
          reminders += 1;
        }
      }
    }
    if (p.weeklySummary && local.weekday === 0 && local.minutes >= SUMMARY_FROM_MIN && (await claimSlot(db, p.ownerId, 'weekly_summary', local.date))) {
      const s = await weekSummary(db, p, now);
      const review = await queueAutoReview(db, config, p.ownerId);
      await db.insert(scheduledPushes).values({
        ownerId: p.ownerId,
        kind: 'weekly_summary',
        fireAt: now,
        title: 'Tu semana',
        body: s.text + (review ? ' Tu coach está preparando el análisis de tu progreso.' : ''),
        url: review ? '/coach' : '/progress',
      });
      summaries += 1;
    }
  }
  return { reminders, summaries };
}

/** Sessions of the last 36 h whose start falls on that local date (completed or in progress). */
async function trainedOn(db: Database, ownerId: string, timeZone: string, localDate: string, now: Date) {
  const since = new Date(now.getTime() - 36 * 3_600_000).toISOString();
  const rows = await db
    .select({ at: workoutSessions.startedAt })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.ownerId, ownerId), isNull(workoutSessions.deletedAt), gte(workoutSessions.startedAt, since), inArray(workoutSessions.status, ['completed', 'in_progress'])));
  return rows.some((r) => localParts(new Date(r.at), timeZone).date === localDate);
}

export async function weekSummary(db: Database, p: typeof profiles.$inferSelect, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const sessions = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.ownerId, p.ownerId), isNull(workoutSessions.deletedAt), eq(workoutSessions.status, 'completed'), gte(workoutSessions.startedAt, since)));
  const weights = await db
    .select({ kg: bodyMeasurements.weightKg })
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.ownerId, p.ownerId), isNull(bodyMeasurements.deletedAt), gte(bodyMeasurements.measuredAt, new Date(now.getTime() - 14 * 86_400_000).toISOString())))
    .orderBy(bodyMeasurements.measuredAt);
  const kg = weights.map((w) => w.kg).filter((x): x is number => x != null);
  const n = sessions.length;
  let text = `Entrenaste ${n} de ${p.daysPerWeek} ${p.daysPerWeek === 1 ? 'día' : 'días'}.`;
  if (n >= p.daysPerWeek) text += ' ¡Meta cumplida!';
  if (kg.length >= 2) {
    const d = Math.round((kg.at(-1)! - kg[0]!) * 10) / 10;
    text += d === 0 ? ' Tu peso se mantuvo.' : ` Tu peso ${d < 0 ? 'bajó' : 'subió'} ${Math.abs(d).toLocaleString('es')} kg.`;
  }
  return { sessions: n, text };
}

/** Queues the automatic weekly progress review (it counts toward the person's daily AI limit). */
async function queueAutoReview(db: Database, config: Env, ownerId: string) {
  const settings = await getSettings(db);
  if (!availability(settings, config).available) return false;
  const [used] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(coachRequests)
    .where(and(eq(coachRequests.ownerId, ownerId), gte(coachRequests.createdAt, sql`date_trunc('day', now())`)));
  if ((used?.n ?? 0) >= settings.aiDailyLimitPerUser) return false;
  const [row] = await db
    .insert(coachRequests)
    .values({ ownerId, kind: 'weekly_review', messages: [{ role: 'user', content: 'Revisión semanal automática: analiza mi progreso hacia mi objetivo.' }], status: 'queued' })
    .onConflictDoNothing()
    .returning({ id: coachRequests.id });
  return Boolean(row);
}
