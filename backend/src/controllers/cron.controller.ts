import type { RequestHandler } from 'express';
import { env } from '../lib/env';
import { logger } from '../lib/logger';
import { findUsersNeedingReminder, sendReminderToUser } from '../services/reminder.service';

/**
 * GET /internal/cron/check-reminders
 *
 * Triggered by an external scheduler (cron-job.org) every ~10 minutes.
 * Guarded by the CRON_SECRET shared secret header so it's safe to leave
 * unauthenticated. Returns {checked, sent, failed} so the scheduler log
 * surfaces useful info.
 */
export const checkReminders: RequestHandler = async (req, res) => {
  if (!env.CRON_SECRET) {
    res.status(503).json({ error: 'NOT_CONFIGURED', message: 'CRON_SECRET is not set' });
    return;
  }
  const provided = req.header('x-cron-secret');
  if (provided !== env.CRON_SECRET) {
    res.status(401).json({ error: 'UNAUTHORIZED' });
    return;
  }

  const due = await findUsersNeedingReminder();
  const results = await Promise.allSettled(due.map((u) => sendReminderToUser(u)));
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - sent;
  logger.info({ checked: due.length, sent, failed }, 'Reminder cron tick');
  res.json({ checked: due.length, sent, failed });
};
