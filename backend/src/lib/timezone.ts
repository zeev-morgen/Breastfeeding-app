/**
 * Tiny timezone helpers built on the platform `Intl` API — keeps the dependency
 * surface small while still being DST-aware. Good enough for scheduling a daily
 * summary and computing "start of day" in a given IANA timezone.
 */

export interface WallClock {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  second: number; // 0-59
}

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = PARTS_FORMATTER_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    PARTS_FORMATTER_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

/** Wall-clock parts of `instant` as observed in `timeZone`. */
export function wallClockInTimeZone(instant: Date, timeZone: string): WallClock {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** How far ahead of UTC `timeZone` is at `instant`, in milliseconds. */
function tzOffsetMs(instant: Date, timeZone: string): number {
  const wc = wallClockInTimeZone(instant, timeZone);
  const asUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  return asUtc - instant.getTime();
}

/**
 * Convert a wall-clock time in `timeZone` to the corresponding UTC instant.
 * (Near DST transitions this is accurate to the standard one-pass correction.)
 */
export function zonedWallClockToUtc(wc: WallClock, timeZone: string): Date {
  const guessUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  const offset = tzOffsetMs(new Date(guessUtc), timeZone);
  return new Date(guessUtc - offset);
}

/** Start of the calendar day (00:00:00) in `timeZone` for the given instant. */
export function startOfDayInTimeZone(instant: Date, timeZone: string): Date {
  const wc = wallClockInTimeZone(instant, timeZone);
  return zonedWallClockToUtc(
    { year: wc.year, month: wc.month, day: wc.day, hour: 0, minute: 0, second: 0 },
    timeZone,
  );
}
