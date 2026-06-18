import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { buildGuidance } from '../services/guidance.service';
import { dynamicIntervalForUser } from '../services/interval.service';
import { isNightTime, setPendingNightConsent } from '../services/feeding-reminder.service';
import { formatFeedingReminder, formatNightConsent } from '../services/whatsapp.service';
import { isWhatsAppSenderConfigured, sendWhatsAppMessage } from '../services/whatsapp-sender.service';

// userId → the nextFeedingAt (ms) we've already reminded for. Prevents nagging:
// one reminder per feeding window. In-memory by design (resets on restart).
const remindedFor = new Map<string, number>();

/**
 * Send a proactive feeding reminder to every user whose next feeding is due.
 * Inside the night window we send a yes/no consent prompt instead of a reminder.
 */
export async function runFeedingReminders(now = new Date()): Promise<{ sent: number }> {
  const users = await prisma.user.findMany({
    where: { phoneE164: { not: null } },
    select: { id: true, phoneE164: true, feedingIntervalHours: true },
  });

  let sent = 0;
  for (const user of users) {
    const phone = user.phoneE164;
    if (!phone) continue;

    const latest = await prisma.feedingLog.findFirst({
      where: { userId: user.id },
      orderBy: { startTime: 'desc' },
    });
    if (!latest) continue; // nothing to base a prediction on yet

    const fallback = user.feedingIntervalHours ?? env.FEEDING_INTERVAL_HOURS;
    const interval = await dynamicIntervalForUser(user.id, fallback);
    const guidance = buildGuidance(latest, interval);

    const dueAt = guidance.nextFeedingAt.getTime();
    if (dueAt > now.getTime()) continue; // not due yet
    if (remindedFor.get(user.id) === dueAt) continue; // already reminded for this window
    remindedFor.set(user.id, dueAt);

    const ok = isNightTime(now)
      ? (setPendingNightConsent(phone, guidance.nextSide),
        await sendWhatsAppMessage(phone, formatNightConsent(guidance.nextSide, now)))
      : await sendWhatsAppMessage(phone, formatFeedingReminder(guidance.nextSide));
    if (ok) sent += 1;
  }

  return { sent };
}

/**
 * In-process scheduler: ticks once a minute and fires due feeding reminders.
 * No external cron dependency.
 */
export function startFeedingReminderScheduler(): { stop: () => void } | null {
  if (!env.FEEDING_REMINDER_ENABLED) {
    logger.info('Feeding reminder scheduler disabled (FEEDING_REMINDER_ENABLED=false)');
    return null;
  }
  if (!isWhatsAppSenderConfigured()) {
    logger.warn('Feeding reminder scheduler not started: Twilio outbound is not configured');
    return null;
  }

  const timer = setInterval(() => {
    runFeedingReminders().catch((err) => logger.error({ err }, 'Feeding reminder run failed'));
  }, 60_000);
  timer.unref();
  logger.info('Feeding reminder scheduler started');
  return { stop: () => clearInterval(timer) };
}
