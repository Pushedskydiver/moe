import { z } from 'zod';

/**
 * GOV.UK's real response shape (verified live against `https://www.gov.uk/bank-holidays.json`,
 * 2026-07-18) nests one object per division (`england-and-wales`, `scotland`,
 * `northern-ireland`); only `england-and-wales` is validated here — BUILD_PLAN 2.7a scopes the
 * holiday calendar to that division (Alex confirmed). Unvalidated sibling keys are dropped by
 * Zod's default object parsing, not an intentional feature this code relies on.
 */
const bankHolidaysResponseSchema = z.object({
  'england-and-wales': z.object({
    division: z.literal('england-and-wales'),
    events: z.array(
      z.object({
        title: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        notes: z.string(),
        bunting: z.boolean(),
      }),
    ),
  }),
});

const BANK_HOLIDAYS_URL = 'https://www.gov.uk/bank-holidays.json';

export type FetchBankHolidaysError =
  | { readonly kind: 'network-error'; readonly cause: unknown }
  | { readonly kind: 'http-error'; readonly status: number }
  | { readonly kind: 'invalid-json'; readonly cause: unknown }
  | { readonly kind: 'validation-failed'; readonly issues: string };

export type FetchBankHolidaysResult =
  | { readonly ok: true; readonly dates: readonly string[] }
  | { readonly ok: false; readonly error: FetchBankHolidaysError };

type FetchRawResult =
  | { readonly ok: true; readonly response: Response }
  | { readonly ok: false; readonly error: FetchBankHolidaysError };

// Isolates the only statement that can throw (the network call itself) behind a `try`/`catch`
// that returns a `Result` — keeps the caller's control flow a plain sequence of early returns,
// with no `let` needed to smuggle a value out of a `try` block (`functional/no-let`).
async function fetchRaw(fetchFn: typeof fetch): Promise<FetchRawResult> {
  try {
    return { ok: true, response: await fetchFn(BANK_HOLIDAYS_URL) };
  } catch (cause) {
    return { ok: false, error: { kind: 'network-error', cause } };
  }
}

type ParseJsonBodyResult =
  | { readonly ok: true; readonly body: unknown }
  | { readonly ok: false; readonly error: FetchBankHolidaysError };

// A 2xx response with an unparseable body (an HTML maintenance page served with the wrong
// content-type, a truncated download) makes `Response.json()` reject a `SyntaxError` — same
// "expected domain failure, not a thrown exception" reasoning as `fetchRaw` above, isolated the
// same way. Left unguarded, that rejection would propagate all the way through `Cached.get()`'s
// unguarded `await this.fetchFresh()` and crash a long-running persona process on what is really
// just a transient upstream hiccup.
async function parseJsonBody(response: Response): Promise<ParseJsonBodyResult> {
  try {
    return { ok: true, body: await response.json() };
  } catch (cause) {
    return { ok: false, error: { kind: 'invalid-json', cause } };
  }
}

/**
 * Fetches the england-and-wales UK bank-holiday calendar (BUILD_PLAN 2.7a) as a plain list of
 * `YYYY-MM-DD` date strings — the caller (`bank-holidays-cache.js`) owns caching/staleness
 * fallback; this function always does a live network call, no memoization of its own.
 * `fetchFn` defaults to the global `fetch` and exists purely as a DI seam for tests
 * (`docs/CONVENTIONS.md`'s "pass the client, don't import a live implementation" rule).
 */
export async function fetchUkBankHolidays(
  fetchFn: typeof fetch = fetch,
): Promise<FetchBankHolidaysResult> {
  const raw = await fetchRaw(fetchFn);
  if (!raw.ok) return raw;

  if (!raw.response.ok) {
    return {
      ok: false,
      error: { kind: 'http-error', status: raw.response.status },
    };
  }

  const parsedBody = await parseJsonBody(raw.response);
  if (!parsedBody.ok) return parsedBody;

  const parsed = bankHolidaysResponseSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: 'validation-failed', issues: parsed.error.message },
    };
  }

  return {
    ok: true,
    dates: parsed.data['england-and-wales'].events.map((event) => event.date),
  };
}
