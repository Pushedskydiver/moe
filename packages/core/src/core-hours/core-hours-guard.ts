import type { Cached } from './cached.js';
import type { CoreHoursConfig } from './core-hours-config.js';

import { DEFAULT_CORE_HOURS_CONFIG } from './core-hours-config.js';
import { isWithinCoreHoursWindow } from './core-hours.js';

export type OperatingRhythmReason =
  | 'within-core-hours'
  | 'outside-window'
  | 'bank-holiday'
  | 'holiday-status-unknown';

export type OperatingRhythmDecision = {
  readonly withinCoreHours: boolean;
  readonly reason: OperatingRhythmReason;
};

/**
 * The full VISION §6.4/§14 operating-rhythm decision for proactive persona behavior (sends,
 * intake drafts) — BUILD_PLAN 2.7a. **Not** consulted by direct-DM replies, which always proceed
 * regardless of core hours (Alex confirmed via `AskUserQuestion`: a DM is reactive engagement,
 * not Moe acting unprompted, so §14's rest rule doesn't reach it) — callers on that path should
 * not call this function at all, rather than call it and ignore the result.
 *
 * Short-circuits on the pure weekday/clock-time check (`./core-hours.js`) before ever touching
 * the network — a weekend or an off-hours weekday instant never needs a holiday lookup. Only when
 * that check passes is `bankHolidaysCache` consulted. If the cache has never completed a
 * successful fetch (a cold-boot failure, no fallback value to serve), the decision fails CLOSED
 * (`withinCoreHours: false, reason: 'holiday-status-unknown'`) — matching §14's hard "never
 * operate on a bank holiday" rule: better to wrongly rest once than wrongly act on an actual
 * holiday. A stale-but-previously-successful cache read still counts as a known answer, not
 * unknown.
 */
export async function evaluateOperatingRhythm(
  instant: Date,
  bankHolidaysCache: Cached<readonly string[], unknown>,
  config: CoreHoursConfig = DEFAULT_CORE_HOURS_CONFIG,
): Promise<OperatingRhythmDecision> {
  if (!isWithinCoreHoursWindow(instant, config)) {
    return { withinCoreHours: false, reason: 'outside-window' };
  }

  const holidays = await bankHolidaysCache.get();
  if (!holidays.ok) {
    return { withinCoreHours: false, reason: 'holiday-status-unknown' };
  }

  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone,
  }).format(instant);
  if (holidays.value.includes(localDate)) {
    return { withinCoreHours: false, reason: 'bank-holiday' };
  }

  return { withinCoreHours: true, reason: 'within-core-hours' };
}
