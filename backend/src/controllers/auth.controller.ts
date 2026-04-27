import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signToken } from '../lib/jwt';
import { env } from '../lib/env';
import { conflict, notFound, unauthorized } from '../lib/errors';
import { LinkPhoneSchema, LoginSchema, RegisterSchema } from '../schemas/auth.schema';

export const register: RequestHandler = async (req, res) => {
  const input = RegisterSchema.parse(req.body);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, ...(input.phoneE164 ? [{ phoneE164: input.phoneE164 }] : [])],
    },
    select: { id: true },
  });
  if (existing) throw conflict('Email or phone already registered');

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      phoneE164: input.phoneE164,
    },
    select: { id: true, email: true, displayName: true, phoneE164: true },
  });

  const token = signToken({ sub: user.id, email: user.email });
  res.status(201).json({ user, token });
};

export const login: RequestHandler = async (req, res) => {
  const input = LoginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user?.passwordHash) throw unauthorized('Invalid credentials');

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw unauthorized('Invalid credentials');

  const token = signToken({ sub: user.id, email: user.email });
  res.json({
    user: { id: user.id, email: user.email, displayName: user.displayName, phoneE164: user.phoneE164 },
    token,
  });
};

export const me: RequestHandler = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true, displayName: true, phoneE164: true, feedingIntervalHours: true },
  });
  if (!user) throw notFound('User not found');
  res.json({ user });
};

export const linkPhone: RequestHandler = async (req, res) => {
  const input = LinkPhoneSchema.parse(req.body);
  const conflictUser = await prisma.user.findUnique({ where: { phoneE164: input.phoneE164 } });
  if (conflictUser && conflictUser.id !== req.userId) throw conflict('Phone already linked to another account');

  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: { phoneE164: input.phoneE164 },
    select: { id: true, email: true, displayName: true, phoneE164: true },
  });
  res.json({ user });
};
