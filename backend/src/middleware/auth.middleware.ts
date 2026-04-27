import type { RequestHandler } from 'express';
import { unauthorized } from '../lib/errors';
import { verifyToken } from '../lib/jwt';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Missing bearer token'));
    return;
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
};
