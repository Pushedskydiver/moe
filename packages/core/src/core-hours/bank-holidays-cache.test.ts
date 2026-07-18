import { describe, expect, it, vi } from 'vitest';

import { createBankHolidaysCache } from './bank-holidays-cache.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const VALID_BODY = {
  'england-and-wales': {
    division: 'england-and-wales',
    events: [
      { title: "New Year's Day", date: '2026-01-01', notes: '', bunting: true },
    ],
  },
};

describe('createBankHolidaysCache', () => {
  it('wires fetchUkBankHolidays through a Cached instance, hitting the injected fetch function', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(VALID_BODY));
    const cache = createBankHolidaysCache({ fetchFn });

    const result = await cache.get();

    expect(result).toEqual({ ok: true, value: ['2026-01-01'], stale: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached value on a second get() within the TTL, without a second fetch', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(VALID_BODY));
    const cache = createBankHolidaysCache({ fetchFn });

    await cache.get();
    await cache.get();

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
