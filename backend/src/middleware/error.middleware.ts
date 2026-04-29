import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Express JSON body-parser throws SyntaxError on malformed input
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'BAD_JSON', message: 'Invalid JSON in request body' });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
      details: err.flatten(),
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.code ?? 'ERROR',
      message: err.message,
      details: err.details,
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
};
