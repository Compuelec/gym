import { logger } from './logger';

// Background worker (pg-boss jobs: coach, scheduled push, cleanup). Jobs are added in later phases.
logger.info('worker started (no jobs registered yet)');
