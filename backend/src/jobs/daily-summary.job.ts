import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { startOfDayInTimeZone, wallClockInTimeZone } from '../lib/timezone';
import { buildGuidance } from '../services/guidance.service';
import { dynamicIntervalForUser } from '../services/interval.service';
import { buildDailySummaryMessage } from '../services/feeding-summary.service';
import { isWhatsAppSenderConfigured, sendWhatsAppMessage } from '../services/whatsapp-sender.service';

/**
 * Build and send the detailed daily feeding summary to every user who has a
 * linked WhatsApp number. Safe to call directly (e.g. from a script).
 */
export async function runDailySummary(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const timeZone = env.DAILY_SUMMARY_TIMEZONE;
  const dayStart = startOfDayInTimeZone(now, timeZone);

  const users = await prisma.user.findMany({
    where: { phoneE164: { not: null } },
    select: { id: true, phoneE164: true, feedingIntervalHours: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const phone = user.phoneE164;
    if (!phone) {
      skipped += 1;
      continue;
    }

    const feedings = await prisma.feedingLog.findMany({
      where: { userId: user.id, startTime: { gte: dayStart } },
      orderBy: { startTime: 'asc' },
    });
    const latest = feedings.length > 0 ? feedings[feedings.length - 1]! : null;

    const fallback = user.feedingIntervalHours ?? env.FEEDING_INTERVAL_HOURS;
    const interval = await dynamicIntervalForUser(user.id, fallback);
    const guidance = buildGuidance(latest, interval);
    const message = buildDailySummaryMessage(feedings, guidance, timeZone, now);

    const ok = await sendWhatsAppMessage(phone, message);
    if (ok) sent += 1;
    else skipped += 1;
  }

  logger.info({ sent, skipped, total: users.length }, 'Daily summary run complete');
  return { sent, skipped };
}

/**
 * Lightweight in-process scheduler: ticks once a minute and fires the daily
 * summary the first time the configured hour is reached on a new calendar day
 * (in the configured timezone). No external cron dependency.
 */
export function startDailySummaryScheduler(): { stop: () => void } | null {
  if (!env.DAILY_SUMMARY_ENABLED) {
    logger.info('Daily summary scheduler disabled (DAILY_SUMMARY_ENABLED=false)');
    return null;
  }
  if (!isWhatsAppSenderConfigured()) {
    logger.warn('Daily summary scheduler not started: Twilio outbound is not configured');
    return null;
  }

  const timeZone = env.DAILY_SUMMARY_TIMEZONE;
  const targetHour = env.DAILY_SUMMARY_HOUR;
  let lastRunDayKey: string | null = null;

  const tick = () => {
    const now = new Date();
    const wc = wallClockInTimeZone(now, timeZone);
    const dayKey = `${wc.year}-${wc.month}-${wc.day}`;
    if (wc.hour === targetHour && lastRunDayKey !== dayKey) {
      lastRunDayKey = dayKey;
      runDailySummary(now).catch((err) => logger.error({ err }, 'Daily summary run failed'));
    }
  };

  const timer = setInterval(tick, 60_000);
  timer.unref();
  logger.info({ targetHour, timeZone }, 'Daily summary scheduler started');
  return { stop: () => clearInterval(timer) };
}
