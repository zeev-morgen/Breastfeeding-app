import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { CreateLogSchema } from '../schemas/log.schema';
import { buildGuidance } from '../services/guidance.service';
import { env } from '../lib/env';

async function intervalHoursForUser(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { feedingIntervalHours: true },
  });
  return user?.feedingIntervalHours ?? env.FEEDING_INTERVAL_HOURS;
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
