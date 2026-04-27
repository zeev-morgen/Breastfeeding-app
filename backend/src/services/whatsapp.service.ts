import type { FeedingLog } from '@prisma/client';
import type { Guidance } from './guidance.service';

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
