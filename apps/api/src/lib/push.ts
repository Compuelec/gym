import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
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

/** Browser push services (Chrome/Android, Firefox, Safari/iOS, Edge). Nothing else is ever called. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

/** Only HTTPS endpoints of real push services: the worker must never be pointed at internal hosts. */
export function isAllowedPushEndpoint(endpoint: string, config: Pick<Env, 'PUSH_EXTRA_HOSTS'>) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;
  const extra = (config.PUSH_EXTRA_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  return PUSH_HOSTS.some((re) => re.test(url.hostname)) || extra.includes(url.hostname);
}

export function createWebPushSender(config: Env): PushSender {
  webpush.setVapidDetails(config.VAPID_SUBJECT, config.VAPID_PUBLIC_KEY!, config.VAPID_PRIVATE_KEY!);
  return async (sub, message) => {
    await webpush.sendNotification(sub, JSON.stringify(message), { TTL: message.tag === 'rest-timer' ? 60 : 3600, urgency: message.tag === 'rest-timer' ? 'high' : 'normal' });
  };
}

export const REST_END_MESSAGE: Omit<PushMessage, 'url'> = {
  title: 'Descanso terminado',
  body: 'Es hora de tu siguiente serie.',
  tag: 'rest-timer',
};

/**
 * Replaces any pending rest notification of the user with a new one at `fireAt`: one person rests
 * in one session at a time, so there is never more than one pending notification per user.
 */
export const REST_WARNING_SECONDS = 10;

/**
 * Replaces any pending rest notification of the user with new ones: a «get ready» 10 s before the
 * end (when the rest is long enough) and the end itself, both naming what comes next. One person
 * rests in one session at a time, so pending rest rows never pile up.
 */
export async function scheduleRestPush(db: Database, ownerId: string, sessionId: string, fireAt: Date, next?: string, now = new Date()) {
  await db.transaction(async (tx) => {
    await tx
      .update(scheduledPushes)
      .set({ cancelledAt: sql`now()` })
      .where(
        and(
          eq(scheduledPushes.ownerId, ownerId),
          inArray(scheduledPushes.kind, ['rest_end', 'rest_warning']),
          isNull(scheduledPushes.sentAt),
          isNull(scheduledPushes.cancelledAt),
        ),
      );
    const url = `/session/${sessionId}`;
    const rows: Array<typeof scheduledPushes.$inferInsert> = [
      { ownerId, sessionId, kind: 'rest_end', fireAt, title: REST_END_MESSAGE.title, body: next ?? REST_END_MESSAGE.body, url },
    ];
    const warnAt = new Date(fireAt.getTime() - REST_WARNING_SECONDS * 1000);
    if (warnAt.getTime() - now.getTime() >= 2000) {
      rows.unshift({ ownerId, sessionId, kind: 'rest_warning', fireAt: warnAt, title: `Quedan ${REST_WARNING_SECONDS} s de descanso`, body: next ? `Prepárate: ${next}` : 'Prepárate para la siguiente serie.', url });
    }
    await tx.insert(scheduledPushes).values(rows);
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
            {
              title: push.title ?? REST_END_MESSAGE.title,
              body: push.body ?? REST_END_MESSAGE.body,
              // Same tag: the end replaces the «get ready» on the lock screen.
              tag: push.kind.startsWith('rest') ? 'rest-timer' : push.kind,
              url: push.url ?? `/session/${push.sessionId}`,
            },
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
