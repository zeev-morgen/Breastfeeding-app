import { describe, expect, it } from 'vitest';
import { classifyYesNo, isNightTime } from './feeding-reminder.service';

// Defaults: APP_TIMEZONE=Asia/Jerusalem, night window [2, 9).
describe('isNightTime', () => {
  it('treats early-morning hours as night', () => {
    // 00:00 UTC = 03:00 IDT (summer, UTC+3) → inside [2,9)
    expect(isNightTime(new Date('2026-06-16T00:00:00Z'))).toBe(true);
  });
  it('treats midday as not night', () => {
    // 09:00 UTC = 12:00 IDT → outside the window
    expect(isNightTime(new Date('2026-06-16T09:00:00Z'))).toBe(false);
  });
  it('excludes the end hour (09:00 is daytime)', () => {
    // 06:00 UTC = 09:00 IDT → hour === end → not night
    expect(isNightTime(new Date('2026-06-16T06:00:00Z'))).toBe(false);
  });
});

describe('classifyYesNo', () => {
  it('recognizes affirmatives', () => {
    expect(classifyYesNo('כן')).toBe('yes');
    expect(classifyYesNo(' שלחי ')).toBe('yes');
    expect(classifyYesNo('yes')).toBe('yes');
  });
  it('recognizes negatives', () => {
    expect(classifyYesNo('לא')).toBe('no');
    expect(classifyYesNo('no')).toBe('no');
  });
  it('returns unknown for anything else', () => {
    expect(classifyYesNo('אולי אחר כך')).toBe('unknown');
  });
});
