import { serve } from '@hono/node-server';
import { createApp } from './app';
import { getDb } from './db/client';
import { env } from './env';
import { createSyncRegistry } from './entities';
import { logger } from './logger';

const config = env();
const app = createApp({ db: getDb(), config, registry: createSyncRegistry() });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  logger.info({ port: info.port }, 'api listening');
});
