import type { FeedingLog } from '@prisma/client';
import type { Guidance } from './guidance.service';
import { env } from '../lib/env';
import { wallClockInTimeZone } from '../lib/timezone';

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
  const phrase = hours > 0 ? `${hours} שע׳ ${remMins} ד׳` : `${mins} ד׳`;
  return diffMs >= 0 ? `בעוד ${phrase}` : `לפני ${phrase}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatClock(when: Date): string {
  const wc = wallClockInTimeZone(when, env.APP_TIMEZONE);
  return `${pad2(wc.hour)}:${pad2(wc.minute)}`;
}

export function formatStatusMessage(latest: FeedingLog | null, guidance: Guidance): string {
  const lines: string[] = [];
  if (latest) {
    lines.push(
      `📋 אחרונה: ${SIDE_LABEL[latest.side]} • ${latest.durationMin} ד׳ • איכות ${latest.qualityScore}/5 (${formatRelative(latest.startTime)})`,
    );
  } else {
    lines.push('📋 עדיין לא תועדו הנקות.');
  }
  lines.push(
    `➡️ הבאה: צד ${SIDE_LABEL[guidance.nextSide]} בסביבות ${formatClock(guidance.nextFeedingAt)} (${formatRelative(guidance.nextFeedingAt)})`,
  );
  if (guidance.tip) lines.push(`💡 טיפ: ${guidance.tip}`);
  return lines.join('\n');
}

export function formatLoggedConfirmation(log: FeedingLog, guidance: Guidance): string {
  return [
    `✅ נרשם: ${SIDE_LABEL[log.side]} • ${log.durationMin} ד׳ • איכות ${log.qualityScore}/5 • בשעה ${formatClock(log.startTime)}`,
    `➡️ הבאה: צד ${SIDE_LABEL[guidance.nextSide]} בסביבות ${formatClock(guidance.nextFeedingAt)}`,
    guidance.tip ? `💡 טיפ: ${guidance.tip}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const HELP_MESSAGE = [
  '👶 *LactaSync* — לתיעוד הנקה פשוט שלחי הודעה:',
  '• "20 דקות ימין, יניקה מצוינת"',
  '• "שמאל 15 דקות, היתה קצת חסרת מנוחה"',
  '• "שני הצדדים 25 דקות"',
  '',
  'אפשר גם רק לציין צד ("הנקתי שמאל") — משך ואיכות יקבלו ערכי ברירת מחדל.',
  '',
  'פקודות:',
  '• *סטטוס* – ההנקה האחרונה + תחזית להנקה הבאה',
  '• *עזרה* – הצגת הודעה זו',
].join('\n');

export const UNKNOWN_MESSAGE =
  '🤔 לא הבנתי. נסי למשל: "20 דקות ימין, יניקה טובה" או שלחי *סטטוס*.';

export const LOW_CONFIDENCE_MESSAGE = (parsed: {
  side: string | null;
  durationMin: number | null;
  qualityScore: number | null;
}) => {
  const sideHe =
    parsed.side === 'LEFT' ? 'שמאל' : parsed.side === 'RIGHT' ? 'ימין' : parsed.side === 'BOTH' ? 'שני הצדדים' : '?';
  return (
    `🤔 לא בטוחה שהבנתי. הבנתי: צד=${sideHe}, משך=${parsed.durationMin ?? '?'} ד׳, איכות=${parsed.qualityScore ?? '?'}.\n` +
    'חשוב לציין לפחות צד, למשל: "שמאל 15 דקות איכות 4".'
  );
};
