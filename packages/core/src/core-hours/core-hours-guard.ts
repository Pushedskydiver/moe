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
 * The full VISION §6.4/§14 operating-rhythm decision for **unprompted** persona behavior (proactive
 * sends, ambient intake drafts) — BUILD_PLAN 2.7a.
 *
 * **Not** consulted by anything a human message directly triggered. That started as "direct-DM
 * replies" (Alex confirmed via `AskUserQuestion`: a DM is reactive engagement, not Moe acting
 * unprompted, so §14's rest rule doesn't reach it) and BUILD_PLAN 3.7 extended it to the whole
 * DM-triggered intake cascade, on the same reasoning: a ticket draft composed *because* Alex sent
 * a DM is as reactive as the reply it replaces. Reaction-outcome dispatch (3.4a-iii, 3.4b-ii) is
 * exempt for the same reason. Callers on those paths should not call this function at all, rather
 * than call it and ignore the result.
 *
 * **That exemption is about rest, not about spend — do not read it as "skip the guards".** The
 * per-persona cost cap (`checkCostCapAndAlert`, BUILD_PLAN 2.6b) still applies to every billed
 * call on those paths, and chunk 3.3's own DA review caught a real, uncapped Anthropic call that
 * shipped precisely because a new path was treated as guard-exempt wholesale. `apps/server`'s
 * `isCostAndRhythmGuardSatisfied` bundles the cap check together with this one for the ambient
 * path, so a reactive caller wanting "cap but not rhythm" must reach for the cap check directly
 * rather than skipping the pair.
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
