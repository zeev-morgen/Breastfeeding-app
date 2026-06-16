import { describe, expect, it } from 'vitest';
import type { FeedingLog } from '@prisma/client';
import {
  buildGuidance,
  computeDynamicIntervalHours,
  predictNextFeedingAt,
  predictNextSide,
} from './guidance.service';

function fakeLog(overrides: Partial<FeedingLog> = {}): FeedingLog {
  const now = new Date('2025-01-01T08:00:00.000Z');
  return {
    id: '11111111-1111-1111-1111-111111111111',
    userId: 'user-1',
    side: 'LEFT',
    qualityScore: 4,
    durationMin: 15,
    startTime: now,
    endTime: new Date(now.getTime() + 15 * 60_000),
    notes: null,
    source: 'APP',
    rawMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('predictNextSide', () => {
  it('alternates LEFT → RIGHT', () => {
    expect(predictNextSide(fakeLog({ side: 'LEFT' }))).toBe('RIGHT');
  });
  it('alternates RIGHT → LEFT', () => {
    expect(predictNextSide(fakeLog({ side: 'RIGHT' }))).toBe('LEFT');
  });
  it('falls back to LEFT for BOTH or empty history', () => {
    expect(predictNextSide(fakeLog({ side: 'BOTH' }))).toBe('LEFT');
    expect(predictNextSide(null)).toBe('LEFT');
  });
});

describe('predictNextFeedingAt', () => {
  it('adds the configured interval to the last start_time', () => {
    const log = fakeLog({ startTime: new Date('2025-01-01T08:00:00Z') });
    expect(predictNextFeedingAt(log, 3).toISOString()).toBe('2025-01-01T11:00:00.000Z');
  });
});

describe('computeDynamicIntervalHours', () => {
  it('spreads the last 3 days feedings across the 72h window', () => {
    // 24 feedings over 3 days → roughly every 3 hours.
    expect(computeDynamicIntervalHours(24, 3)).toBe(3);
    // 36 feedings → every 2 hours.
    expect(computeDynamicIntervalHours(36, 3)).toBe(2);
  });
  it('falls back when there is too little history (< 6 feedings)', () => {
    expect(computeDynamicIntervalHours(0, 3)).toBe(3);
    expect(computeDynamicIntervalHours(1, 3)).toBe(3); // would be 72h raw — use fallback instead
    expect(computeDynamicIntervalHours(5, 2.5)).toBe(2.5);
  });
  it('clamps the dynamic result to a sane range', () => {
    expect(computeDynamicIntervalHours(6, 3)).toBe(4); // 72/6=12 → clamp to max 4
    expect(computeDynamicIntervalHours(72, 3)).toBe(1.5); // 72/72=1 → clamp to min 1.5
  });
});

describe('buildGuidance', () => {
  it('omits the tip when last quality >= 3', () => {
    expect(buildGuidance(fakeLog({ qualityScore: 4 }), 3).tip).toBeNull();
  });
  it('returns a corrective tip when last quality < 3', () => {
    const g = buildGuidance(fakeLog({ qualityScore: 2 }), 3);
    expect(g.tip).toBeTruthy();
  });
});
