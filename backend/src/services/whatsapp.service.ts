import twilio from 'twilio';
import type { FeedingLog } from '@prisma/client';
import type { Guidance } from './guidance.service';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

const SIDE_LABEL: Record<FeedingLog['side'], string> = {
  LEFT: 'Left',
  RIGHT: 'Right',
  BOTH: 'Both',
};

function formatRelative(when: Date, now = new Date()): string {
  const diffMs = when.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const phrase = hours > 0 ? `${hours}h ${remMins}m` : `${mins}m`;
  return diffMs >= 0 ? `in ${phrase}` : `${phrase} ago`;
}

function formatClock(when: Date): string {
  return when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatStatusMessage(latest: FeedingLog | null, guidance: Guidance): string {
  const lines: string[] = [];
  if (latest) {
    lines.push(
      `📋 Last: ${SIDE_LABEL[latest.side]} • ${latest.durationMin} min • quality ${latest.qualityScore}/5 (${formatRelative(latest.startTime)})`,
    );
  } else {
    lines.push('📋 No sessions logged yet.');
  }
  lines.push(
    `➡️ Next: ${SIDE_LABEL[guidance.nextSide]} side around ${formatClock(guidance.nextFeedingAt)} (${formatRelative(guidance.nextFeedingAt)})`,
  );
  if (guidance.tip) lines.push(`💡 Tip: ${guidance.tip}`);
  return lines.join('\n');
}

export function formatLoggedConfirmation(log: FeedingLog, guidance: Guidance): string {
  return [
    `✅ Logged: ${SIDE_LABEL[log.side]} • ${log.durationMin} min • quality ${log.qualityScore}/5`,
    `➡️ Next: ${SIDE_LABEL[guidance.nextSide]} around ${formatClock(guidance.nextFeedingAt)}`,
    guidance.tip ? `💡 Tip: ${guidance.tip}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const HELP_MESSAGE = [
  '👶 *LactaSync* — log feedings by texting:',
  '• "20 min on the right, latch was great"',
  '• "Left 15m, she was fussy"',
  '• "both 25 min"',
  '',
  'Commands:',
  '• *status* – last session + next feed prediction',
  '• *help* – show this message',
].join('\n');

export const UNKNOWN_MESSAGE =
  '🤔 I didn\'t catch that. Try: "20 min on the right, good latch" or send *status*.';

export const LOW_CONFIDENCE_MESSAGE = (parsed: {
  side: string | null;
  durationMin: number | null;
  qualityScore: number | null;
}) =>
  `🤔 I think you meant: side=${parsed.side ?? '?'}, duration=${parsed.durationMin ?? '?'}m, quality=${parsed.qualityScore ?? '?'}.\nReply with corrections, e.g. "left 15 min quality 4".`;

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
