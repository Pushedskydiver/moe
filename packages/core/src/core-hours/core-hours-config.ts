/**
 * VISION §6.4's operating-rhythm parameters, settled at BUILD_PLAN chunk 2.7a (Alex confirmed,
 * `AskUserQuestion`, not inferred): 08:30–17:00 Europe/London, Mon–Fri. `weekdays` uses ISO-8601
 * weekday numbers (1 = Monday .. 7 = Sunday) to stay unambiguous across locales — `Intl`'s own
 * `weekday: 'short'` output varies by locale, so `core-hours.ts` maps it to this same numbering
 * rather than comparing locale-formatted strings directly.
 */
export type CoreHoursConfig = {
  readonly timeZone: string;
  readonly weekdays: readonly number[];
  readonly startTime: string;
  readonly endTime: string;
};

export const DEFAULT_CORE_HOURS_CONFIG: CoreHoursConfig = {
  timeZone: 'Europe/London',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '08:30',
  endTime: '17:00',
};
