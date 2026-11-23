import { getDb } from './db/client';
import { env } from './env';
import { createWebPushSender, pushEnabled, sendDuePushes } from './lib/push';
import { logger } from './logger';

/**
 * Background worker: polls for due rest-timer notifications every 2 s. A simple table poll keeps
 * the stack to Postgres only (no queue service); more jobs (coach) are added in later stories.
 */
const config = env();
const db = getDb();
const INTERVAL_MS = 2000;

async function tick() {
  if (pushEnabled(config)) {
    const result = await sendDuePushes(db, createWebPushSender(config));
    if (result.due > 0) logger.info(result, 'rest pushes processed');
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
