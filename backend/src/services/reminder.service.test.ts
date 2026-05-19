import { describe, expect, it } from 'vitest';
import type { FeedingLog, User } from '@prisma/client';
import { isReminderDue, type UserWithLatest } from './reminder.service';

const NOW = new Date('2025-01-01T12:00:00.000Z');
const DEFAULT_INTERVAL = 3;

function fakeLog(startTime: Date): FeedingLog {
  return {
    id: 'log-1',
    userId: 'user-1',
    side: 'LEFT',
    qualityScore: 4,
    durationMin: 15,
    startTime,
    endTime: null,
    notes: null,
    source: 'APP',
    rawMessage: null,
    createdAt: startTime,
    updatedAt: startTime,
  };
}

function fakeUser(overrides: Partial<User> & { feedingLogs?: FeedingLog[] } = {}): UserWithLatest {
  const { feedingLogs, ...rest } = overrides;
  return {
    id: 'user-1',
    email: 'mom@example.com',
    passwordHash: null,
    phoneE164: '+972500000000',
    displayName: 'Mom',
    feedingIntervalHours: null,
    notificationsEnabled: true,
    lastReminderAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...rest,
    feedingLogs: feedingLogs ?? [],
  };
}

describe('isReminderDue', () => {
  it('returns false when the user has no phone number', () => {
    const u = fakeUser({
      phoneE164: null,
      feedingLogs: [fakeLog(new Date(NOW.getTime() - 5 * 3600_000))],
    });
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(false);
  });

  it('returns false when notifications are disabled', () => {
    const u = fakeUser({
      notificationsEnabled: false,
      feedingLogs: [fakeLog(new Date(NOW.getTime() - 5 * 3600_000))],
    });
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(false);
  });

  it('returns false when the user has never logged a feeding', () => {
    const u = fakeUser({ feedingLogs: [] });
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(false);
  });

  it('returns false when the interval has not yet elapsed', () => {
    const u = fakeUser({ feedingLogs: [fakeLog(new Date(NOW.getTime() - 2 * 3600_000))] });
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(false);
  });

  it('returns true when the interval has elapsed and no prior reminder', () => {
    const u = fakeUser({ feedingLogs: [fakeLog(new Date(NOW.getTime() - 4 * 3600_000))] });
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(true);
  });

  it('throttles: returns false if reminded within the last interval', () => {
    const u = fakeUser({
      feedingLogs: [fakeLog(new Date(NOW.getTime() - 4 * 3600_000))],
      lastReminderAt: new Date(NOW.getTime() - 1 * 3600_000),
    });
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(false);
  });

  it('returns true again once the throttle window has passed', () => {
    const u = fakeUser({
      feedingLogs: [fakeLog(new Date(NOW.getTime() - 7 * 3600_000))],
      lastReminderAt: new Date(NOW.getTime() - 4 * 3600_000),
    });
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(true);
  });

  it('honors a per-user feedingIntervalHours override', () => {
    const u = fakeUser({
      feedingIntervalHours: 5,
      feedingLogs: [fakeLog(new Date(NOW.getTime() - 4 * 3600_000))],
    });
    // 4h elapsed, user's interval is 5h → not yet due.
    expect(isReminderDue(u, NOW, DEFAULT_INTERVAL)).toBe(false);
  });
});
