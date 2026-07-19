import { describe, expect, it, vi } from 'vitest';

import { createSeenEventCache } from './seen-event-cache.js';

function makeClock(startMs = 0) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe('createSeenEventCache', () => {
  it('reports an unseen event id as not seen', () => {
    const cache = createSeenEventCache();

    expect(cache.hasSeen('Ev123')).toBe(false);
  });

  it('reports an event id as seen once marked', () => {
    const cache = createSeenEventCache();

    cache.markSeen('Ev123');

    expect(cache.hasSeen('Ev123')).toBe(true);
  });

  it('keeps other event ids independent of a marked one', () => {
    const cache = createSeenEventCache();

    cache.markSeen('Ev123');

    expect(cache.hasSeen('Ev456')).toBe(false);
  });

  it('expires a seen event id once the TTL has elapsed', () => {
    const clock = makeClock();
    const cache = createSeenEventCache({ ttlMs: 1000, now: clock.now });

    cache.markSeen('Ev123');
    clock.advance(1000);

    expect(cache.hasSeen('Ev123')).toBe(false);
  });

  it('still reports a seen event id as seen just before the TTL elapses', () => {
    const clock = makeClock();
    const cache = createSeenEventCache({ ttlMs: 1000, now: clock.now });

    cache.markSeen('Ev123');
    clock.advance(999);

    expect(cache.hasSeen('Ev123')).toBe(true);
  });

  it('prunes every expired entry, not just the one being checked', () => {
    const clock = makeClock();
    const cache = createSeenEventCache({ ttlMs: 1000, now: clock.now });

    cache.markSeen('Ev123');
    cache.markSeen('Ev456');
    clock.advance(1000);
    cache.markSeen('Ev789');

    // Checking Ev789 (fresh) triggers a prune pass; Ev123/Ev456 should both be gone, not just
    // whichever one happened to be looked up.
    expect(cache.hasSeen('Ev789')).toBe(true);
    expect(cache.hasSeen('Ev123')).toBe(false);
    expect(cache.hasSeen('Ev456')).toBe(false);
  });

  it('reports a forgotten event id as not seen again', () => {
    const cache = createSeenEventCache();

    cache.markSeen('Ev123');
    cache.forget('Ev123');

    expect(cache.hasSeen('Ev123')).toBe(false);
  });

  it('does nothing when forgetting an event id that was never marked seen', () => {
    const cache = createSeenEventCache();

    expect(() => cache.forget('Ev123')).not.toThrow();
    expect(cache.hasSeen('Ev123')).toBe(false);
  });

  it('defaults to a real wall-clock TTL long enough to cover Slack’s own retry window (~6 minutes across 3 attempts) when no options are given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T09:00:00.000Z'));
    try {
      const cache = createSeenEventCache();

      cache.markSeen('Ev123');
      vi.advanceTimersByTime(6 * 60 * 1000);

      expect(cache.hasSeen('Ev123')).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
