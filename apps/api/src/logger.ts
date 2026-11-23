import pino from 'pino';

// Secrets and health data must never reach the logs (constitution, principles IV and V).
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.apiKey',
      '*.token',
    ],
    censor: '[redacted]',
  },
});
