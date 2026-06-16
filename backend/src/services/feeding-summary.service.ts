import type { FeedingLog, Side } from '@prisma/client';
import type { Guidance } from './guidance.service';
import { wallClockInTimeZone } from '../lib/timezone';

const SIDE_LABEL_HE: Record<Side, string> = {
  LEFT: 'שמאל',
  RIGHT: 'ימין',
  BOTH: 'שני הצדדים',
};

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function clockInTz(when: Date, timeZone: string): string {
  const wc = wallClockInTimeZone(when, timeZone);
  return `${pad2(wc.hour)}:${pad2(wc.minute)}`;
}

function dateInTz(when: Date, timeZone: string): string {
  const wc = wallClockInTimeZone(when, timeZone);
  return `${pad2(wc.day)}/${pad2(wc.month)}/${wc.year}`;
}

/**
 * Detailed Hebrew daily feeding summary for WhatsApp. `feedings` should be the
 * sessions logged during the day, oldest-first.
 */
export function buildDailySummaryMessage(
  feedings: FeedingLog[],
  guidance: Guidance,
  timeZone: string,
  now = new Date(),
): string {
  const lines: string[] = [`🍼 *סיכום הנקות יומי* — ${dateInTz(now, timeZone)}`, ''];

  if (feedings.length === 0) {
    lines.push('לא תועדו הנקות היום. 🤍');
    lines.push(`➡️ ההנקה הבאה המומלצת: צד ${SIDE_LABEL_HE[guidance.nextSide]} בסביבות ${clockInTz(guidance.nextFeedingAt, timeZone)}.`);
    return lines.join('\n');
  }

  const totalMin = feedings.reduce((sum, f) => sum + f.durationMin, 0);
  const avgQuality = feedings.reduce((sum, f) => sum + f.qualityScore, 0) / feedings.length;
  const bySide: Record<Side, number> = { LEFT: 0, RIGHT: 0, BOTH: 0 };
  for (const f of feedings) bySide[f.side] += 1;

  lines.push(`📊 סה"כ ${feedings.length} הנקות • ${totalMin} דקות • איכות ממוצעת ${avgQuality.toFixed(1)}/5`);
  lines.push(`↔️ לפי צד: שמאל ${bySide.LEFT} • ימין ${bySide.RIGHT} • שני הצדדים ${bySide.BOTH}`);
  lines.push('');
  lines.push('🕒 *פירוט:*');
  for (const f of feedings) {
    lines.push(
      `• ${clockInTz(f.startTime, timeZone)} — ${SIDE_LABEL_HE[f.side]} • ${f.durationMin} ד׳ • איכות ${f.qualityScore}/5`,
    );
  }
  lines.push('');
  lines.push(
    `➡️ ההנקה הבאה המומלצת: צד ${SIDE_LABEL_HE[guidance.nextSide]} בסביבות ${clockInTz(guidance.nextFeedingAt, timeZone)}.`,
  );
  if (guidance.tip) lines.push(`💡 טיפ: ${guidance.tip}`);

  return lines.join('\n');
}
