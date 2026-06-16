import { describe, expect, it } from 'vitest';
import type { FeedingLog } from '@prisma/client';
import { buildDailySummaryMessage } from './feeding-summary.service';
import type { Guidance } from './guidance.service';

const TZ = 'Asia/Jerusalem';
const NOW = new Date('2026-06-16T19:30:00Z'); // 22:30 IDT

function fakeLog(overrides: Partial<FeedingLog> = {}): FeedingLog {
  const start = new Date('2026-06-16T05:00:00Z'); // 08:00 IDT
  return {
    id: '11111111-1111-1111-1111-111111111111',
    userId: 'user-1',
    side: 'LEFT',
    qualityScore: 4,
    durationMin: 15,
    startTime: start,
    endTime: new Date(start.getTime() + 15 * 60_000),
    notes: null,
    source: 'APP',
    rawMessage: null,
    createdAt: start,
    updatedAt: start,
    ...overrides,
  };
}

const guidance: Guidance = {
  nextSide: 'RIGHT',
  nextFeedingAt: new Date('2026-06-16T20:00:00Z'), // 23:00 IDT
  intervalHours: 2.5,
  tip: null,
};

describe('buildDailySummaryMessage', () => {
  it('summarizes totals, per-side breakdown and a per-feeding list', () => {
    const feedings = [
      fakeLog({ startTime: new Date('2026-06-16T05:00:00Z'), side: 'LEFT', durationMin: 10, qualityScore: 4 }),
      fakeLog({ startTime: new Date('2026-06-16T09:00:00Z'), side: 'RIGHT', durationMin: 20, qualityScore: 2 }),
    ];
    const msg = buildDailySummaryMessage(feedings, guidance, TZ, NOW);

    expect(msg).toContain('16/06/2026');
    expect(msg).toContain('2 הנקות');
    expect(msg).toContain('30 דקות');
    expect(msg).toContain('3.0/5'); // (4+2)/2 average quality
    expect(msg).toContain('שמאל 1');
    expect(msg).toContain('ימין 1');
    expect(msg).toContain('08:00'); // first feeding clock in TZ
    expect(msg).toContain('12:00'); // second feeding clock in TZ
    expect(msg).toContain('23:00'); // next recommended feeding in TZ
  });

  it('handles a day with no feedings', () => {
    const msg = buildDailySummaryMessage([], guidance, TZ, NOW);
    expect(msg).toContain('לא תועדו הנקות היום');
    expect(msg).toContain('23:00');
  });
});
