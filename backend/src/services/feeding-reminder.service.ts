import type { Side } from '@prisma/client';
import { env } from '../lib/env';
import { wallClockInTimeZone } from '../lib/timezone';

/**
 * True when `instant` falls inside the configured night window (in APP_TIMEZONE),
 * during which we ASK before sending a feeding reminder instead of just sending it.
 * Handles windows that wrap past midnight.
 */
export function isNightTime(instant: Date): boolean {
  const { hour } = wallClockInTimeZone(instant, env.APP_TIMEZONE);
  const start = env.REMINDER_NIGHT_START_HOUR;
  const end = env.REMINDER_NIGHT_END_HOUR;
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

export type YesNo = 'yes' | 'no' | 'unknown';

/** Lightweight, LLM-free classification of a yes/no reply (Hebrew + English). */
export function classifyYesNo(text: string): YesNo {
  const t = text.trim().toLowerCase();
  if (/^(כן|כ|בטח|אוקיי|אוקי|שלחי|שלח|yes|y|ok|okay|👍)$/.test(t)) return 'yes';
  if (/^(לא|די|לדלג|לא צריך|no|n|👎)$/.test(t)) return 'no';
  return 'unknown';
}

// In-memory pending night-consent prompts, keyed by phone (E.164). Cleared on
// reply; lost on restart (acceptable — a stale prompt simply goes unanswered).
const pendingConsent = new Map<string, { side: Side }>();

export function setPendingNightConsent(phone: string, side: Side): void {
  pendingConsent.set(phone, { side });
}

export function peekPendingNightConsent(phone: string): { side: Side } | null {
  return pendingConsent.get(phone) ?? null;
}

export function clearPendingNightConsent(phone: string): void {
  pendingConsent.delete(phone);
}
