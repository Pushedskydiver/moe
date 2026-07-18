import { describe, expect, it, vi } from 'vitest';

import { fetchUkBankHolidays } from './bank-holidays-client.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const VALID_BODY = {
  'england-and-wales': {
    division: 'england-and-wales',
    events: [
      { title: "New Year's Day", date: '2026-01-01', notes: '', bunting: true },
      { title: 'Good Friday', date: '2026-04-03', notes: '', bunting: false },
    ],
  },
  scotland: { division: 'scotland', events: [] },
};

describe('fetchUkBankHolidays', () => {
  it('extracts the england-and-wales division dates from a valid response', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(VALID_BODY));

    const result = await fetchUkBankHolidays(mockFetch);

    expect(result).toEqual({
      ok: true,
      dates: ['2026-01-01', '2026-04-03'],
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.gov.uk/bank-holidays.json',
    );
  });

  it('returns a network-error result when the fetch itself rejects', async () => {
    const networkFailure = new Error('getaddrinfo ENOTFOUND www.gov.uk');
    const mockFetch = vi.fn<typeof fetch>().mockRejectedValue(networkFailure);

    const result = await fetchUkBankHolidays(mockFetch);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'network-error', cause: networkFailure },
    });
  });

  it('returns an http-error result for a non-2xx response', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ error: 'server error' }, 503));

    const result = await fetchUkBankHolidays(mockFetch);

    expect(result).toEqual({
      ok: false,
      error: { kind: 'http-error', status: 503 },
    });
  });

  it('returns a validation-failed result when the body does not match the expected shape', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ unexpected: 'shape' }));

    const result = await fetchUkBankHolidays(mockFetch);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('validation-failed');
  });

  it('returns an invalid-json result instead of throwing when a 2xx response body is not valid JSON', async () => {
    const htmlMaintenancePage = new Response('<html>gov.uk is down</html>', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(htmlMaintenancePage);

    const result = await fetchUkBankHolidays(mockFetch);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('invalid-json');
  });
});
