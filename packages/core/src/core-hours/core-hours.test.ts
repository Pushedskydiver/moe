import { describe, expect, it } from 'vitest';

import { isWithinCoreHoursWindow } from './core-hours.js';

describe('isWithinCoreHoursWindow', () => {
  it('is within the window at the exact start time on a weekday (winter, GMT)', () => {
    // 2026-01-12 is a Monday. Europe/London is GMT (UTC+0) in January, so 08:30 UTC is 08:30 local.
    const monday0830Gmt = new Date('2026-01-12T08:30:00Z');
    expect(isWithinCoreHoursWindow(monday0830Gmt)).toBe(true);
  });

  it('is outside the window one minute before the start time', () => {
    const monday0829Gmt = new Date('2026-01-12T08:29:00Z');
    expect(isWithinCoreHoursWindow(monday0829Gmt)).toBe(false);
  });

  it('is outside the window at the exact end time (end-exclusive)', () => {
    const monday1700Gmt = new Date('2026-01-12T17:00:00Z');
    expect(isWithinCoreHoursWindow(monday1700Gmt)).toBe(false);
  });

  it('is within the window one minute before the end time', () => {
    const monday1659Gmt = new Date('2026-01-12T16:59:00Z');
    expect(isWithinCoreHoursWindow(monday1659Gmt)).toBe(true);
  });

  it('is outside the window on a Saturday, even at a normally-in-window clock time', () => {
    // 2026-01-10 is a Saturday.
    const saturdayNoonGmt = new Date('2026-01-10T12:00:00Z');
    expect(isWithinCoreHoursWindow(saturdayNoonGmt)).toBe(false);
  });

  it('is outside the window on a Sunday', () => {
    // 2026-01-11 is a Sunday.
    const sundayNoonGmt = new Date('2026-01-11T12:00:00Z');
    expect(isWithinCoreHoursWindow(sundayNoonGmt)).toBe(false);
  });

  it('accounts for British Summer Time — the local hour shifts even though the UTC instant does not', () => {
    // 2026-07-13 is a Monday. Europe/London is BST (UTC+1) in July, so 07:30 UTC is 08:30 local —
    // within the window — while the same 07:30 UTC clock time in January (GMT, UTC+0) is not.
    const mondaySummer0730Utc = new Date('2026-07-13T07:30:00Z');
    expect(isWithinCoreHoursWindow(mondaySummer0730Utc)).toBe(true);

    const mondayWinter0730Utc = new Date('2026-01-12T07:30:00Z');
    expect(isWithinCoreHoursWindow(mondayWinter0730Utc)).toBe(false);
  });

  it('respects a custom config over the default', () => {
    const nineToFiveConfig = {
      timeZone: 'Europe/London',
      weekdays: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '17:30',
    };
    const monday0830Gmt = new Date('2026-01-12T08:30:00Z');
    expect(isWithinCoreHoursWindow(monday0830Gmt, nineToFiveConfig)).toBe(
      false,
    );
  });
});
