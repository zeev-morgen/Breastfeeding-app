import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

type Source = 'body' | 'query' | 'params';

export function validate<T extends ZodTypeAny>(schema: T, source: Source = 'body'): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    // Replace the source with the parsed (and coerced) data so handlers see clean types.
    (req as unknown as Record<Source, z.infer<T>>)[source] = parsed.data;
    next();
  };
}
