import type { FeedingLog, Side } from '@prisma/client';
import { env } from '../lib/env';

export interface Guidance {
  nextSide: Side;
  nextFeedingAt: Date;
  intervalHours: number;
  tip: string | null;
}

const TIPS_LOW_QUALITY: readonly string[] = [
  'Try a deep latch: aim baby\'s nose toward the nipple so they tilt their head back and take a wide mouthful.',
  'Switch nursing position (cross-cradle, football, or laid-back) — a different angle often improves transfer.',
  'Compress the breast gently while feeding to keep milk flowing and baby actively swallowing.',
  'Check baby\'s tongue movement — a shallow latch causes pinching pain and poor transfer; unlatch and re-latch.',
  'Skin-to-skin for a few minutes before the next session to calm a fussy baby and trigger let-down.',
];

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Side prediction: alternate from the last side. BOTH or no history → start LEFT.
 */
export function predictNextSide(last: FeedingLog | null): Side {
  if (!last) return 'LEFT';
  if (last.side === 'LEFT') return 'RIGHT';
  if (last.side === 'RIGHT') return 'LEFT';
  return 'LEFT';
}

/**
 * Time prediction: last start time + configured interval (default 3h).
 */
export function predictNextFeedingAt(last: FeedingLog | null, intervalHours: number, now = new Date()): Date {
  if (!last) {
    return new Date(now.getTime() + intervalHours * 60 * 60 * 1000);
  }
  return new Date(last.startTime.getTime() + intervalHours * 60 * 60 * 1000);
}

/**
 * Dynamic tip: surfaced only when the previous quality_score < 3.
 * Stable rotation per-log so the user sees a different tip on retries.
 */
export function pickTip(last: FeedingLog | null): string | null {
  if (!last || last.qualityScore >= 3) return null;
  const idx = hashStringToInt(last.id) % TIPS_LOW_QUALITY.length;
  return TIPS_LOW_QUALITY[idx]!;
}

export function buildGuidance(last: FeedingLog | null, intervalHours = env.FEEDING_INTERVAL_HOURS): Guidance {
  return {
    nextSide: predictNextSide(last),
    nextFeedingAt: predictNextFeedingAt(last, intervalHours),
    intervalHours,
    tip: pickTip(last),
  };
}
