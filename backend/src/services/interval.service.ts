import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { DYNAMIC_INTERVAL_WINDOW_HOURS, computeDynamicIntervalHours } from './guidance.service';

/**
 * Personalize the reminder interval from how often the baby actually fed over
 * the last 3 days (72 / feedings-in-window). Falls back to the user's
 * configured interval — or the global default — when there is no recent history.
 */
export async function dynamicIntervalForUser(userId: string, fallbackHours?: number): Promise<number> {
  const fallback = fallbackHours ?? env.FEEDING_INTERVAL_HOURS;
  const since = new Date(Date.now() - DYNAMIC_INTERVAL_WINDOW_HOURS * 60 * 60 * 1000);
  const count = await prisma.feedingLog.count({
    where: { userId, startTime: { gte: since } },
  });
  return computeDynamicIntervalHours(count, fallback);
}
