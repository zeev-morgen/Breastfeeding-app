import twilio from 'twilio';
import type { FeedingLog } from '@prisma/client';
import type { Guidance } from './guidance.service';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

const SIDE_LABEL: Record<FeedingLog['side'], string> = {
  LEFT: 'שמאל',
  RIGHT: 'ימין',
  BOTH: 'שני הצדדים',
};

function formatRelative(when: Date, now = new Date()): string {
  const diffMs = when.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const phrase = hours > 0 ? `${hours} שעות ו-${remMins} דק׳` : `${mins} דק׳`;
  return diffMs >= 0 ? `בעוד ${phrase}` : `לפני ${phrase}`;
}

function formatClock(when: Date): string {
  return when.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatStatusMessage(latest: FeedingLog | null, guidance: Guidance): string {
  const lines: string[] = [];
  if (latest) {
    lines.push(
      `📋 ההנקה האחרונה: ${SIDE_LABEL[latest.side]} • איכות ${latest.qualityScore}/5 (${formatRelative(latest.startTime)})`,
    );
  } else {
    lines.push('📋 עדיין לא תיעדת הנקות.');
  }
  lines.push(
    `➡️ הבאה בערך: ${SIDE_LABEL[guidance.nextSide]} בשעה ${formatClock(guidance.nextFeedingAt)} (${formatRelative(guidance.nextFeedingAt)})`,
  );
  if (guidance.tip) lines.push(`💡 טיפ: ${guidance.tip}`);
  return lines.join('\n');
}

export function formatLoggedConfirmation(log: FeedingLog, guidance: Guidance): string {
  return [
    `✅ נרשמה הנקה: ${SIDE_LABEL[log.side]} • איכות ${log.qualityScore}/5`,
    `➡️ הבאה: ${SIDE_LABEL[guidance.nextSide]} בערך ב-${formatClock(guidance.nextFeedingAt)}`,
    guidance.tip ? `💡 טיפ: ${guidance.tip}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const HELP_MESSAGE = [
  '👶 *LactaSync* — לתיעוד הנקה כתבי הודעה חופשית:',
  '• "20 דקות ימין, אחיזה טובה"',
  '• "שמאל 15 דקות, היא הייתה רגועה"',
  '• "שני הצדדים 25 דקות"',
  '',
  'פקודות:',
  '• *סטטוס* – מציג את ההנקה האחרונה ותחזית להבאה',
  '• *עזרה* – מציג את ההודעה הזו',
].join('\n');

export const UNKNOWN_MESSAGE =
  '🤔 לא הצלחתי להבין. נסי משהו כמו: "20 דקות ימין, אחיזה טובה", או שלחי *סטטוס*.';

export const LOW_CONFIDENCE_MESSAGE = (parsed: {
  side: string | null;
  durationMin: number | null;
  qualityScore: number | null;
}) => {
  const sideHe = parsed.side === 'LEFT' ? 'שמאל' : parsed.side === 'RIGHT' ? 'ימין' : parsed.side === 'BOTH' ? 'שני הצדדים' : '?';
  return `🤔 כך הבנתי: צד=${sideHe}, משך=${parsed.durationMin ?? '?'} דק׳, איכות=${parsed.qualityScore ?? '?'}.\nאם זה לא נכון, ענו עם תיקון. לדוגמה: "שמאל 15 דקות איכות 4".`;
};

// Hebrew reminder shown when the configured interval has elapsed without any
// feeding being logged. Kept short so it works as a sandbox-friendly nudge.
export function formatReminderMessage(hoursSinceLast: number): string {
  const hours = Math.max(1, Math.floor(hoursSinceLast));
  return `שלום 🌸 חלפו כ-${hours} שעות מההנקה האחרונה. אם זה הזמן — אפשר לתעד ישר באפליקציה או לשלוח לי כאן.`;
}

// Twilio client is created lazily so the service still boots cleanly in
// environments where the Twilio creds aren't configured (CI / unit tests).
let cachedClient: ReturnType<typeof twilio> | null = null;
function getTwilioClient(): ReturnType<typeof twilio> | null {
  if (cachedClient) return cachedClient;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return null;
  cachedClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return cachedClient;
}

/**
 * Send a WhatsApp message via the Twilio sandbox (or any configured number).
 * Returns true on success, false when the message couldn't be sent (missing
 * config, Twilio rejection, etc.) — the caller decides whether to retry.
 */
export async function sendWhatsApp(toE164: string, body: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!client || !env.TWILIO_WHATSAPP_FROM) {
    logger.warn({ toE164 }, 'Twilio not configured — skipping outbound WhatsApp');
    return false;
  }
  try {
    await client.messages.create({
      from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${toE164}`,
      body,
    });
    return true;
  } catch (err) {
    logger.error({ err, toE164 }, 'Failed to send WhatsApp message');
    return false;
  }
}
