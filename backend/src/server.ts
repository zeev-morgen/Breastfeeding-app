import { createApp } from './app';
import { env } from './lib/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { startDailySummaryScheduler } from './jobs/daily-summary.job';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`LactaSync API listening on :${env.PORT} (${env.NODE_ENV})`);
});

const dailySummary = startDailySummaryScheduler();

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  dailySummary?.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Last-resort safety nets so a stray rejection/exception doesn't take the
// whole server down silently mid-request. These should never fire if
// express-async-errors is doing its job.
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
});
