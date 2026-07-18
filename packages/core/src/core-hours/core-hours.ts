import type { CoreHoursConfig } from './core-hours-config.js';

import { DEFAULT_CORE_HOURS_CONFIG } from './core-hours-config.js';

const ISO_WEEKDAY_NUMBERS: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function toMinutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * `Intl.DateTimeFormat.formatToParts` with `weekday`/`hour`/`minute` always returns all three
 * parts for a valid IANA `timeZone` — the guard below is an invariant check (a bug if it ever
 * fires), not a real domain failure, so it throws rather than returning a `Result`.
 */
function localWeekdayAndMinutes(
  instant: Date,
  timeZone: string,
): { readonly isoWeekday: number; readonly minutesSinceMidnight: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  const isoWeekday = weekday ? ISO_WEEKDAY_NUMBERS[weekday] : undefined;

  if (isoWeekday === undefined || hour === undefined || minute === undefined) {
    throw new Error(
      `Intl.DateTimeFormat returned an unparseable result for timeZone "${timeZone}"`,
    );
  }

  return {
    isoWeekday,
    minutesSinceMidnight: Number(hour) * 60 + Number(minute),
  };
}

/**
 * Pure weekday + clock-time check against `config`'s local timezone (VISION §6.4, BUILD_PLAN
 * 2.7a) — DST-safe because it reads `instant`'s local wall-clock time via `Intl`'s own IANA
 * timezone database rather than a fixed UTC offset. Does not know about bank holidays; compose
 * with a holiday check (`../core-hours-guard.js`) for the full operating-rhythm decision. The
 * window is start-inclusive, end-exclusive — `startTime` itself counts as within the window,
 * `endTime` itself does not.
 */
export function isWithinCoreHoursWindow(
  instant: Date,
  config: CoreHoursConfig = DEFAULT_CORE_HOURS_CONFIG,
): boolean {
  const { isoWeekday, minutesSinceMidnight } = localWeekdayAndMinutes(
    instant,
    config.timeZone,
  );
  if (!config.weekdays.includes(isoWeekday)) return false;

  const start = toMinutesSinceMidnight(config.startTime);
  const end = toMinutesSinceMidnight(config.endTime);
  return minutesSinceMidnight >= start && minutesSinceMidnight < end;
}
