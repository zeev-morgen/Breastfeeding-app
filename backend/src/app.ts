// Patch Express 4 so async route handlers' rejections reach the error middleware
// instead of crashing the process via Node's unhandled-rejection exit.
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { authRouter } from './routes/auth.routes';
import { logsRouter } from './routes/logs.routes';
import { whatsappRouter } from './routes/whatsapp.routes';
import { cronRouter } from './routes/cron.routes';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './lib/logger';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Webhook router parses urlencoded bodies internally; mount BEFORE the JSON parser
  // so signature validation sees the raw form fields.
  app.use('/webhook', whatsappRouter);

  app.use(express.json({ limit: '64kb' }));
  app.use('/api/auth', authRouter);
  app.use('/api/logs', logsRouter);
  app.use('/internal/cron', cronRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` });
  });

  app.use(errorHandler);
  return app;
}
