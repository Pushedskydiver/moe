import { describe, expect, it, vi } from 'vitest';

import { Cached } from './cached.js';

const TTL_MS = 60_000;

describe('Cached', () => {
  it('fetches fresh on the first get() call', async () => {
    const fetchFresh = vi.fn().mockResolvedValue({ ok: true, value: 'first' });
    const cache = new Cached(fetchFresh, TTL_MS);

    const result = await cache.get();

    expect(result).toEqual({ ok: true, value: 'first', stale: false });
    expect(fetchFresh).toHaveBeenCalledTimes(1);
  });

  it('serves the cached value without refetching while still within the TTL', async () => {
    const fetchFresh = vi.fn().mockResolvedValue({ ok: true, value: 'first' });
    let nowMs = 0;
    const cache = new Cached(fetchFresh, TTL_MS, () => nowMs);

    await cache.get();
    nowMs += TTL_MS - 1;
    const second = await cache.get();

    expect(second).toEqual({ ok: true, value: 'first', stale: false });
    expect(fetchFresh).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL has elapsed', async () => {
    const fetchFresh = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: 'first' })
      .mockResolvedValueOnce({ ok: true, value: 'second' });
    let nowMs = 0;
    const cache = new Cached(fetchFresh, TTL_MS, () => nowMs);

    await cache.get();
    nowMs += TTL_MS;
    const second = await cache.get();

    expect(second).toEqual({ ok: true, value: 'second', stale: false });
    expect(fetchFresh).toHaveBeenCalledTimes(2);
  });

  it('forces a refetch when refresh is true even within the TTL', async () => {
    const fetchFresh = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: 'first' })
      .mockResolvedValueOnce({ ok: true, value: 'second' });
    const cache = new Cached(fetchFresh, TTL_MS, () => 0);

    await cache.get();
    const second = await cache.get({ refresh: true });

    expect(second).toEqual({ ok: true, value: 'second', stale: false });
    expect(fetchFresh).toHaveBeenCalledTimes(2);
  });

  it('serves the last known-good value, marked stale, when a refresh fails', async () => {
    const failure = { kind: 'network-error' as const };
    const fetchFresh = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: 'first' })
      .mockResolvedValueOnce({ ok: false, error: failure });
    let nowMs = 0;
    const cache = new Cached(fetchFresh, TTL_MS, () => nowMs);

    await cache.get();
    nowMs += TTL_MS;
    const second = await cache.get();

    expect(second).toEqual({ ok: true, value: 'first', stale: true });
    expect(fetchFresh).toHaveBeenCalledTimes(2);
  });

  it('surfaces the failure when a refresh fails and nothing has ever been cached', async () => {
    const failure = { kind: 'network-error' as const };
    const fetchFresh = vi.fn().mockResolvedValue({ ok: false, error: failure });
    const cache = new Cached(fetchFresh, TTL_MS, () => 0);

    const result = await cache.get();

    expect(result).toEqual({ ok: false, error: failure });
  });
});
