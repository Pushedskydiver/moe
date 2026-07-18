import type { Cached } from './cached.js';

import { describe, expect, it, vi } from 'vitest';

import { evaluateOperatingRhythm } from './core-hours-guard.js';

function fakeBankHolidaysCache(
  get: Cached<readonly string[], unknown>['get'],
): Cached<readonly string[], unknown> {
  return { get } as Cached<readonly string[], unknown>;
}

describe('evaluateOperatingRhythm', () => {
  it('returns false without consulting the holiday cache when outside the clock-hours window', async () => {
    // 2026-01-10 is a Saturday.
    const saturdayNoon = new Date('2026-01-10T12:00:00Z');
    const get = vi.fn();
    const cache = fakeBankHolidaysCache(get);

    const decision = await evaluateOperatingRhythm(saturdayNoon, cache);

    expect(decision).toEqual({
      withinCoreHours: false,
      reason: 'outside-window',
    });
    expect(get).not.toHaveBeenCalled();
  });

  it('returns true when within the window and the date is not a bank holiday', async () => {
    // 2026-01-12 is a Monday, 08:30 UTC = 08:30 local (GMT).
    const mondayWithinWindow = new Date('2026-01-12T08:30:00Z');
    const cache = fakeBankHolidaysCache(
      vi
        .fn()
        .mockResolvedValue({ ok: true, value: ['2026-01-01'], stale: false }),
    );

    const decision = await evaluateOperatingRhythm(mondayWithinWindow, cache);

    expect(decision).toEqual({
      withinCoreHours: true,
      reason: 'within-core-hours',
    });
  });

  it('returns false when within the window but the local date is a bank holiday', async () => {
    // 2026-01-01 is a Thursday, within a normal working window.
    const newYearsDay = new Date('2026-01-01T08:30:00Z');
    const cache = fakeBankHolidaysCache(
      vi
        .fn()
        .mockResolvedValue({ ok: true, value: ['2026-01-01'], stale: false }),
    );

    const decision = await evaluateOperatingRhythm(newYearsDay, cache);

    expect(decision).toEqual({
      withinCoreHours: false,
      reason: 'bank-holiday',
    });
  });

  it('fails closed when the holiday cache has no answer at all', async () => {
    const mondayWithinWindow = new Date('2026-01-12T08:30:00Z');
    const cache = fakeBankHolidaysCache(
      vi
        .fn()
        .mockResolvedValue({ ok: false, error: { kind: 'network-error' } }),
    );

    const decision = await evaluateOperatingRhythm(mondayWithinWindow, cache);

    expect(decision).toEqual({
      withinCoreHours: false,
      reason: 'holiday-status-unknown',
    });
  });
});
