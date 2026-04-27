import { z } from 'zod';

const phoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be E.164, e.g. +14155552671');

export const RegisterSchema = z
  .object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(8).max(128),
    displayName: z.string().min(1).max(80).optional(),
    phoneE164: phoneE164.optional(),
  })
  .strict();

export const LoginSchema = z
  .object({
    email: z.string().email().toLowerCase(),
    password: z.string().min(1),
  })
  .strict();

export const LinkPhoneSchema = z.object({ phoneE164 }).strict();
