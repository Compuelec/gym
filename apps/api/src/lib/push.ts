import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import webpush from 'web-push';
import type { Database } from '../db/client';
import { pushSubscriptions, scheduledPushes } from '../db/schema';
import type { Env } from '../env';
import { logger } from '../logger';

export interface PushMessage {
  title: string;
  body: string;
  tag: string;
  url: string;
}

export type PushSender = (
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  message: PushMessage,
) => Promise<void>;

export function pushEnabled(config: Env) {
  return Boolean(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);
}

export function createWebPushSender(config: Env): PushSender {
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
  return async (sub, message) => {
    await webpush.sendNotification(sub, JSON.stringify(message), { TTL: 60, urgency: 'high' });
  };
}

export const REST_END_MESSAGE: Omit<PushMessage, 'url'> = {
  title: 'Descanso terminado',
  body: 'Es hora de tu siguiente serie.',
  tag: 'rest-timer',
};

/** Replaces any pending rest notification of the session with a new one at `fireAt`. */
export async function scheduleRestPush(db: Database, ownerId: string, sessionId: string, fireAt: Date) {
  await db.transaction(async (tx) => {
    await cancelRestPushTx(tx, ownerId, sessionId);
    await tx.insert(scheduledPushes).values({ ownerId, sessionId, kind: 'rest_end', fireAt });
  });
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

async function cancelRestPushTx(tx: Tx | Database, ownerId: string, sessionId: string) {
  await tx
    .update(scheduledPushes)
    .set({ cancelledAt: sql`now()` })
    .where(
      and(
        eq(scheduledPushes.ownerId, ownerId),
        eq(scheduledPushes.sessionId, sessionId),
        isNull(scheduledPushes.sentAt),
        isNull(scheduledPushes.cancelledAt),
      ),
    );
}

export function cancelRestPush(db: Database, ownerId: string, sessionId: string) {
  return cancelRestPushTx(db, ownerId, sessionId);
}

/**
 * Sends every due notification once. Rows are locked with SKIP LOCKED so two workers never send
 * the same one. Subscriptions the push service reports as gone (404/410) are removed.
 */
export async function sendDuePushes(db: Database, send: PushSender, now = new Date()) {
  return db.transaction(async (tx) => {
    const due = await tx
      .select()
      .from(scheduledPushes)
      .where(and(lte(scheduledPushes.fireAt, now), isNull(scheduledPushes.sentAt), isNull(scheduledPushes.cancelledAt)))
      .limit(50)
      .for('update', { skipLocked: true });
    let sent = 0;
    for (const push of due) {
      const subs = await tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.ownerId, push.ownerId));
      for (const sub of subs) {
        try {
          await send(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            { ...REST_END_MESSAGE, url: `/session/${push.sessionId}` },
          );
          sent += 1;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
          else logger.warn({ status }, 'push send failed');
        }
      }
      await tx.update(scheduledPushes).set({ sentAt: sql`now()` }).where(eq(scheduledPushes.id, push.id));
    }
    return { due: due.length, sent };
  });
}
