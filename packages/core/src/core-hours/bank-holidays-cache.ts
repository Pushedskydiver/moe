import type { FetchBankHolidaysError } from './bank-holidays-client.js';

import { fetchUkBankHolidays } from './bank-holidays-client.js';
import { Cached } from './cached.js';

// GOV.UK republishes the calendar a year or more ahead of need and it changes only a handful of
// times a year (a coronation, a jubilee) — a 24h TTL keeps every persona process well within a
// day of fresh without polling a public government API more than once daily each.
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Builds the `Cached` wrapper real callers (`apps/server`) construct once at process startup and
 * reuse for the process lifetime — the whole point of caching is amortizing across many
 * `evaluateOperatingRhythm` calls, so a fresh `Cached` per call would defeat it. `deps` mirrors
 * `Cached`'s own constructor seams (`fetchFn` for the network call, `ttlMs`/`now` for
 * cache-timing tests) rather than inventing a second DI shape.
 */
export function createBankHolidaysCache(deps?: {
  readonly fetchFn?: typeof fetch;
  readonly ttlMs?: number;
  readonly now?: () => number;
}): Cached<readonly string[], FetchBankHolidaysError> {
  const fetchFn = deps?.fetchFn ?? fetch;
  // Adapts `fetchUkBankHolidays`'s `{ ok, dates }` result to `Cached`'s generic `{ ok, value }`
  // fetch-function contract — the two shapes name the payload differently on purpose (`dates` is
  // the meaningful name at the fetch-client call site; `value` is `Cached<T>`'s deliberately
  // generic field, reused by any future `Cached` consumer).
  return new Cached(
    async () => {
      const result = await fetchUkBankHolidays(fetchFn);
      return result.ok
        ? { ok: true, value: result.dates }
        : { ok: false, error: result.error };
    },
    deps?.ttlMs ?? DEFAULT_TTL_MS,
    deps?.now,
  );
}
