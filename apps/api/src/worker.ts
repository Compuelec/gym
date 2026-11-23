import { getDb } from './db/client';
import { env } from './env';
import { processNextCoachRequest } from './jobs/coach';
import { enqueueDailyNotifications } from './lib/notifications';
import { createWebPushSender, pushEnabled, sendDuePushes } from './lib/push';
import { logger } from './logger';

/**
 * Background worker: polls for due notifications every 2 s (rest timer, reminders, weekly summary). A simple table poll keeps
 * the stack to Postgres only (no queue service). Jobs: rest-timer pushes and coach requests.
 */
const config = env();
const db = getDb();
const INTERVAL_MS = 2000;

let lastDaily = 0;

async function tick() {
  // Reminders and weekly summaries: once a minute is plenty.
  if (pushEnabled(config) && Date.now() - lastDaily >= 60_000) {
    lastDaily = Date.now();
    const r = await enqueueDailyNotifications(db, config);
    if (r.reminders + r.summaries > 0) logger.info(r, 'daily notifications queued');
  }
  if (pushEnabled(config)) {
    const result = await sendDuePushes(db, createWebPushSender(config));
    if (result.due > 0) logger.info(result, 'rest pushes processed');
  }
  // Coach: drain the queue one request at a time.
  while (await processNextCoachRequest(db, config)) {
    // keep going while there is work
  }
}

async function loop() {
  for (;;) {
    try {
      await tick();
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'worker tick failed');
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

logger.info({ push: pushEnabled(config) }, 'worker started');
void loop();
