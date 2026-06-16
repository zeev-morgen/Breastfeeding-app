import { describe, expect, it } from 'vitest';
import { startOfDayInTimeZone, wallClockInTimeZone } from './timezone';

const TZ = 'Asia/Jerusalem';

describe('wallClockInTimeZone', () => {
  it('applies the summer (IDT, UTC+3) offset', () => {
    const wc = wallClockInTimeZone(new Date('2026-06-16T19:30:00Z'), TZ);
    expect(wc).toMatchObject({ year: 2026, month: 6, day: 16, hour: 22, minute: 30 });
  });
  it('applies the winter (IST, UTC+2) offset', () => {
    const wc = wallClockInTimeZone(new Date('2026-01-15T10:00:00Z'), TZ);
    expect(wc).toMatchObject({ year: 2026, month: 1, day: 15, hour: 12, minute: 0 });
  });
});

describe('startOfDayInTimeZone', () => {
  it('returns local midnight as a UTC instant (summer)', () => {
    const start = startOfDayInTimeZone(new Date('2026-06-16T19:30:00Z'), TZ);
    expect(start.toISOString()).toBe('2026-06-15T21:00:00.000Z');
  });
  it('returns local midnight as a UTC instant (winter)', () => {
    const start = startOfDayInTimeZone(new Date('2026-01-15T10:00:00Z'), TZ);
    expect(start.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });
});
