import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from './env';

export interface JwtPayload {
  sub: string;
  email?: string | null;
}

export function signToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || !decoded.sub) {
    throw new Error('Invalid token payload');
  }
  return { sub: String(decoded.sub), email: (decoded as JwtPayload).email };
}
