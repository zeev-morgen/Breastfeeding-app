import type { FeedingLog, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { formatReminderMessage, sendWhatsApp } from './whatsapp.service';

export type UserWithLatest = User & { feedingLogs: FeedingLog[] };

/**
 * Pure version of the "should this user be reminded right now?" predicate.
 * Extracted so it's trivially unit-testable without a DB.
 */
export function isReminderDue(user: UserWithLatest, now: Date, defaultIntervalHours: number): boolean {
  if (!user.phoneE164) return false;
  if (!user.notificationsEnabled) return false;
  const last = user.feedingLogs[0]?.startTime;
  // Never logged a feeding → don't nag with cold messages.
  if (!last) return false;

  const interval = user.feedingIntervalHours ?? defaultIntervalHours;
  const intervalMs = interval * 60 * 60 * 1000;
  const dueAt = last.getTime() + intervalMs;
  if (now.getTime() < dueAt) return false;

  // Throttle: if we already nudged the user within the last interval, hold off
  // so the cron doesn't carpet-bomb every 10 minutes while still due.
  if (user.lastReminderAt && now.getTime() - user.lastReminderAt.getTime() < intervalMs) {
    return false;
  }
  return true;
}

export async function findUsersNeedingReminder(now = new Date()): Promise<UserWithLatest[]> {
  const candidates = await prisma.user.findMany({
    where: { phoneE164: { not: null }, notificationsEnabled: true },
    include: { feedingLogs: { orderBy: { startTime: 'desc' }, take: 1 } },
  });
  return candidates.filter((u) => isReminderDue(u, now, env.FEEDING_INTERVAL_HOURS));
}

export async function sendReminderToUser(user: UserWithLatest, now = new Date()): Promise<boolean> {
  const last = user.feedingLogs[0]?.startTime;
  if (!last || !user.phoneE164) return false;
  const hoursSinceLast = (now.getTime() - last.getTime()) / (60 * 60 * 1000);
  const sent = await sendWhatsApp(user.phoneE164, formatReminderMessage(hoursSinceLast));
  if (sent) {
    await prisma.user.update({ where: { id: user.id }, data: { lastReminderAt: now } });
  } else {
    logger.warn({ userId: user.id }, 'Reminder send failed; not marking lastReminderAt');
  }
  return sent;
}
