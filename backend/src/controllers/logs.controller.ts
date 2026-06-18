import type { RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { CreateLogSchema, UpdateLogSchema } from '../schemas/log.schema';
import { buildGuidance } from '../services/guidance.service';
import { dynamicIntervalForUser } from '../services/interval.service';
import { env } from '../lib/env';

const IdParam = z.string().uuid();

/**
 * Personalized interval for the app: dynamic (72 / feedings in last 3 days),
 * falling back to the user's configured interval when there's no recent history.
 */
async function intervalHoursForUser(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { feedingIntervalHours: true },
  });
  const fallback = user?.feedingIntervalHours ?? env.FEEDING_INTERVAL_HOURS;
  return dynamicIntervalForUser(userId, fallback);
}

export const createLog: RequestHandler = async (req, res) => {
  const input = CreateLogSchema.parse(req.body);
  const userId = req.userId!;

  // Auto-timestamp when client omits start_time (the "immediate report" path).
  const startTime = input.startTime ?? new Date();
  const endTime =
    input.endTime ?? (input.durationMin > 0 ? new Date(startTime.getTime() + input.durationMin * 60_000) : null);

  const log = await prisma.feedingLog.create({
    data: {
      userId,
      side: input.side,
      qualityScore: input.qualityScore,
      durationMin: input.durationMin,
      startTime,
      endTime,
      notes: input.notes,
      source: 'APP',
    },
  });

  const intervalHours = await intervalHoursForUser(userId);
  res.status(201).json({ log, guidance: buildGuidance(log, intervalHours) });
};

export const getLatest: RequestHandler = async (req, res) => {
  const userId = req.userId!;
  const latest = await prisma.feedingLog.findFirst({
    where: { userId },
    orderBy: { startTime: 'desc' },
  });

  const intervalHours = await intervalHoursForUser(userId);
  res.json({ log: latest, guidance: buildGuidance(latest, intervalHours) });
};

export const updateLog: RequestHandler = async (req, res) => {
  const userId = req.userId!;
  const id = IdParam.parse(req.params.id);
  const input = UpdateLogSchema.parse(req.body);

  // Ownership check — only touch the caller's own logs.
  const existing = await prisma.feedingLog.findFirst({ where: { id, userId } });
  if (!existing) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Feeding log not found' });
    return;
  }

  // Recompute endTime when timing/duration changed and the client didn't set it.
  const startTime = input.startTime ?? existing.startTime;
  const durationMin = input.durationMin ?? existing.durationMin;
  const timingChanged = input.startTime !== undefined || input.durationMin !== undefined;
  const endTime =
    input.endTime !== undefined
      ? input.endTime
      : timingChanged
        ? durationMin > 0
          ? new Date(startTime.getTime() + durationMin * 60_000)
          : null
        : existing.endTime;

  const log = await prisma.feedingLog.update({
    where: { id },
    data: {
      side: input.side ?? undefined,
      qualityScore: input.qualityScore ?? undefined,
      durationMin: input.durationMin ?? undefined,
      startTime: input.startTime ?? undefined,
      endTime,
      notes: input.notes === undefined ? undefined : input.notes,
    },
  });

  const intervalHours = await intervalHoursForUser(userId);
  res.json({ log, guidance: buildGuidance(log, intervalHours) });
};

export const deleteLog: RequestHandler = async (req, res) => {
  const userId = req.userId!;
  const id = IdParam.parse(req.params.id);

  // Scope the delete to the owner so a missing/foreign id yields 404, not 500.
  const result = await prisma.feedingLog.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Feeding log not found' });
    return;
  }
  res.json({ ok: true });
};

export const listLogs: RequestHandler = async (req, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
  const logs = await prisma.feedingLog.findMany({
    where: { userId },
    orderBy: { startTime: 'desc' },
    take: limit,
  });
  res.json({ logs });
};
