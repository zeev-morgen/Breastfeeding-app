import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      'env.JWT_SECRET',
      'env.ANTHROPIC_API_KEY',
      'env.TWILIO_AUTH_TOKEN',
    ],
    censor: '[redacted]',
  },
});
