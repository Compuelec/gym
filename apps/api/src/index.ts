import { serve } from '@hono/node-server';
import { createApp } from './app';
import { logger } from './logger';

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: createApp().fetch, port }, (info) => {
  logger.info({ port: info.port }, 'api listening');
});
