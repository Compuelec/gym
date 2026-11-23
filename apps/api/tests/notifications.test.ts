import { afterAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from '@gym/shared';
import { createApp } from '../src/app';
import { appSettings, coachRequests, profiles, pushSubscriptions, scheduledPushes, workoutSessions } from '../src/db/schema';
import { env } from '../src/env';
import { createInvitation } from '../src/lib/invitations';
import { enqueueDailyNotifications, localParts } from '../src/lib/notifications';
import { ORIGIN, createTestDb } from './helpers/test-app';

const { db, pool } = createTestDb();
const config = { ...env(), VAPID_PUBLIC_KEY: 'BPub', VAPID_PRIVATE_KEY: 'priv' };
const app = createApp({ db, config });
afterAll(() => pool.end());

const TZ = 'America/Santiago';
// Wednesday 2026-11-25 at 18:10 in Santiago (UTC−3) and Sunday 2026-11-29 at 19:30.
const WED_1810 = new Date('2026-11-25T21:10:00Z');
const SUN_1930 = new Date('2026-11-29T22:30:00Z');

async function person(profile: Partial<typeof profiles.$inferInsert>, withSub = true) {
  const email = `notif${Date.now()}${Math.random()}@test.local`;
  const res = await app.request('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({ email, password: 'una-clave-segura', name: 'N', inviteCode: (await createInvitation(db)).code }),
  });
  const id = ((await res.json()) as { user: { id: string } }).user.id;
  await db.insert(profiles).values({
    id,
    ownerId: id,
    goal: 'fat_loss',
    level: 'beginner',
    daysPerWeek: 3,
    sessionMinutes: 45,
    units: 'kg',
    medicalAckAt: new Date().toISOString(),
    timeZone: TZ,
    ...profile,
  });
  if (withSub) await db.insert(pushSubscriptions).values({ ownerId: id, endpoint: `https://push.example/${uuidv7()}`, p256dh: 'k', auth: 'a' });
  return id;
}

const queued = (ownerId: string, kind: string) =>
  db.select().from(scheduledPushes).where(and(eq(scheduledPushes.ownerId, ownerId), eq(scheduledPushes.kind, kind)));

describe('daily notifications', () => {
  it('local time in the person\'s time zone', () => {
    expect(localParts(WED_1810, TZ)).toEqual({ date: '2026-11-25', weekday: 3, minutes: 18 * 60 + 10 });
  });

  it('reminds on a chosen day after the chosen time, once', async () => {
    const id = await person({ reminderDays: [1, 3, 5], reminderTime: '18:00' });
    await enqueueDailyNotifications(db, config, WED_1810);
    await enqueueDailyNotifications(db, config, new Date(WED_1810.getTime() + 5 * 60_000));
    const rows = await queued(id, 'reminder');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.title).toBe('¿Entrenamos hoy?');
    expect(rows[0]!.url).toBe('/today');
  });

  it('no reminder before the time, on another day, without push, or long after the time', async () => {
    const early = await person({ reminderDays: [3], reminderTime: '19:00' });
    const otherDay = await person({ reminderDays: [2], reminderTime: '18:00' });
    const noPush = await person({ reminderDays: [3], reminderTime: '18:00' }, false);
    const late = await person({ reminderDays: [3], reminderTime: '15:00' });
    await enqueueDailyNotifications(db, config, WED_1810);
    for (const [name, id] of Object.entries({ early, otherDay, noPush, late })) expect(await queued(id, "reminder"), name).toHaveLength(0);
  });

  it('no reminder when the person already trained that day', async () => {
    const id = await person({ reminderDays: [3], reminderTime: '18:00' });
    await db.insert(workoutSessions).values({ id: uuidv7(), ownerId: id, name: 'Mañana', startedAt: '2026-11-25T11:00:00.000Z', endedAt: '2026-11-25T12:00:00.000Z', status: 'completed' } as typeof workoutSessions.$inferInsert);
    await enqueueDailyNotifications(db, config, WED_1810);
    expect(await queued(id, 'reminder')).toHaveLength(0);
  });

  it('a session late yesterday (same UTC date as today) does not count as today', async () => {
    const id = await person({ reminderDays: [3], reminderTime: '18:00' });
    // 22:30 on Tuesday in Santiago = 01:30 UTC on Wednesday.
    await db.insert(workoutSessions).values({ id: uuidv7(), ownerId: id, name: 'Noche', startedAt: '2026-11-26T01:30:00.000Z', status: 'completed' } as typeof workoutSessions.$inferInsert);
    await db.update(profiles).set({ reminderDays: [4] }).where(eq(profiles.ownerId, id));
    // Thursday 26 at 18:10 local: the session (UTC date 26) was on Wednesday 25 local time.
    await enqueueDailyNotifications(db, config, new Date('2026-11-26T21:10:00Z'));
    expect(await queued(id, 'reminder')).toHaveLength(1);
  });

  it('weekly summary on Sunday evening, once, with the week count; no AI review when the AI is off', async () => {
    await db.update(appSettings).set({ aiEnabled: false });
    const id = await person({ weeklySummary: true, daysPerWeek: 2 });
    for (const d of ['2026-11-24T12:00:00.000Z', '2026-11-27T12:00:00.000Z'])
      await db.insert(workoutSessions).values({ id: uuidv7(), ownerId: id, name: 'S', startedAt: d, endedAt: d, status: 'completed' } as typeof workoutSessions.$inferInsert);
    await enqueueDailyNotifications(db, config, new Date('2026-11-29T21:00:00Z')); // 18:00: too early
    expect(await queued(id, 'weekly_summary')).toHaveLength(0);
    await enqueueDailyNotifications(db, config, SUN_1930);
    await enqueueDailyNotifications(db, config, new Date(SUN_1930.getTime() + 60_000));
    const rows = await queued(id, 'weekly_summary');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.body).toBe('Entrenaste 2 de 2 días. ¡Meta cumplida!');
    expect(rows[0]!.url).toBe('/progress');
    expect(await db.select().from(coachRequests).where(eq(coachRequests.ownerId, id))).toHaveLength(0);
  });

  it('only the owner\'s data is used: another person\'s sessions do not count', async () => {
    const a = await person({ weeklySummary: true });
    const b = await person({ reminderDays: [3], reminderTime: '18:00' });
    await db.insert(workoutSessions).values({ id: uuidv7(), ownerId: a, name: 'A', startedAt: '2026-11-25T12:00:00.000Z', status: 'completed' } as typeof workoutSessions.$inferInsert);
    await enqueueDailyNotifications(db, config, WED_1810);
    expect(await queued(b, 'reminder')).toHaveLength(1);
    await enqueueDailyNotifications(db, config, SUN_1930);
    expect((await queued(a, 'weekly_summary'))[0]!.body).toBe('Entrenaste 1 de 3 días.');
  });
});
