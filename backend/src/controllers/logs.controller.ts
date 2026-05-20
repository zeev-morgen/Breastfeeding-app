import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { CreateLogSchema, LogFromTextSchema, UpdateLogSchema } from '../schemas/log.schema';
import { buildGuidance } from '../services/guidance.service';
import { parseWhatsAppMessage } from '../services/claude.service';
import { env } from '../lib/env';
import { notFound } from '../lib/errors';

const FREE_TEXT_MIN_CONFIDENCE = 0.5;

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

export const updateLog: RequestHandler = async (req, res) => {
  const userId = req.userId!;
  const id = req.params.id!;
  const input = UpdateLogSchema.parse(req.body);

  const existing = await prisma.feedingLog.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Log not found');

  // When startTime changes and endTime wasn't explicitly set, recompute endTime
  // from the (new) start + duration so the row stays internally consistent.
  const nextStart = input.startTime ?? existing.startTime;
  const nextDuration = input.durationMin ?? existing.durationMin;
  let nextEnd: Date | null | undefined = input.endTime;
  if (nextEnd === undefined && (input.startTime || input.durationMin !== undefined)) {
    nextEnd = nextDuration > 0 ? new Date(nextStart.getTime() + nextDuration * 60_000) : null;
  }

  const log = await prisma.feedingLog.update({
    where: { id },
    data: {
      ...(input.side !== undefined ? { side: input.side } : {}),
      ...(input.qualityScore !== undefined ? { qualityScore: input.qualityScore } : {}),
      ...(input.durationMin !== undefined ? { durationMin: input.durationMin } : {}),
      ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
      ...(nextEnd !== undefined ? { endTime: nextEnd } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });

  const intervalHours = await intervalHoursForUser(userId);
  res.json({ log, guidance: buildGuidance(log, intervalHours) });
};

export const deleteLog: RequestHandler = async (req, res) => {
  const userId = req.userId!;
  const id = req.params.id!;
  const existing = await prisma.feedingLog.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('Log not found');
  await prisma.feedingLog.delete({ where: { id } });
  res.status(204).end();
};

/**
 * POST /api/logs/from-text — accept a free-text Hebrew/English message,
 * route it through Claude's parser, and either create the log (when the
 * extraction is confident) or return the parsed values so the client can
 * surface a confirmation step.
 *
 * Response shape:
 *   { status: 'OK', log, guidance, parsed }                — log created
 *   { status: 'NEEDS_CONFIRMATION', parsed, reason }       — client should
 *                                                            prompt the user
 */
export const createLogFromText: RequestHandler = async (req, res) => {
  const { text } = LogFromTextSchema.parse(req.body);
  const userId = req.userId!;

  const parsed = await parseWhatsAppMessage(text);

  if (parsed.intent !== 'LOG_FEEDING') {
    res.json({ status: 'NEEDS_CONFIRMATION', parsed, reason: 'NOT_A_LOG' });
    return;
  }
  if (!parsed.side || parsed.confidence < FREE_TEXT_MIN_CONFIDENCE) {
    res.json({ status: 'NEEDS_CONFIRMATION', parsed, reason: 'LOW_CONFIDENCE' });
    return;
  }

  const startTime = new Date();
  const durationMin = parsed.durationMin ?? 0;
  const log = await prisma.feedingLog.create({
    data: {
      userId,
      side: parsed.side,
      qualityScore: parsed.qualityScore ?? 4,
      durationMin,
      startTime,
      endTime: durationMin > 0 ? new Date(startTime.getTime() + durationMin * 60_000) : null,
      notes: parsed.notes,
      source: 'APP',
      rawMessage: text,
    },
  });

  const intervalHours = await intervalHoursForUser(userId);
  res.status(201).json({
    status: 'OK',
    log,
    guidance: buildGuidance(log, intervalHours),
    parsed,
  });
};
