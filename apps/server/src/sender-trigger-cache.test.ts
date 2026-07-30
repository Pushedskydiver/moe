import { describe, expect, it, vi } from 'vitest';

import { createSenderTriggerCache } from './sender-trigger-cache.js';

function makeClock(startMs = 0) {
  let nowMs = startMs;
  return {
    now: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

function makeInput(overrides: {
  readonly personaId?: string;
  readonly channelId?: string;
  readonly userId?: string;
}) {
  return {
    personaId: 'sarah',
    channelId: 'C123',
    userId: 'U123',
    ...overrides,
  };
}

describe('createSenderTriggerCache', () => {
  it('returns blocked:false and records the trigger the first time a (persona, channel, sender) triple is seen', () => {
    const cache = createSenderTriggerCache();

    expect(cache.checkAndRecord(makeInput({}))).toBe(false);
  });

  it('returns blocked:true for a second trigger from the same (persona, channel, sender) triple within the window', () => {
    const cache = createSenderTriggerCache();

    cache.checkAndRecord(makeInput({}));

    expect(cache.checkAndRecord(makeInput({}))).toBe(true);
  });

  it('keeps a different sender in the same channel independent of an already-triggered one', () => {
    const cache = createSenderTriggerCache();

    cache.checkAndRecord(makeInput({ userId: 'U123' }));

    expect(cache.checkAndRecord(makeInput({ userId: 'U456' }))).toBe(false);
  });

  it('keeps the same sender in a different channel independent of an already-triggered one (BUILD_PLAN 5.3a: scoped to same person + same channel)', () => {
    const cache = createSenderTriggerCache();

    cache.checkAndRecord(makeInput({ channelId: 'C123' }));

    expect(cache.checkAndRecord(makeInput({ channelId: 'C456' }))).toBe(false);
  });

  it('keeps the same sender/channel under a different persona independent — a different persona has its own cooldown', () => {
    const cache = createSenderTriggerCache();

    cache.checkAndRecord(makeInput({ personaId: 'sarah' }));

    expect(cache.checkAndRecord(makeInput({ personaId: 'marcus' }))).toBe(
      false,
    );
  });

  it('allows a trigger again once the window has elapsed', () => {
    const clock = makeClock();
    const cache = createSenderTriggerCache({ windowMs: 1000, now: clock.now });

    cache.checkAndRecord(makeInput({}));
    clock.advance(1000);

    expect(cache.checkAndRecord(makeInput({}))).toBe(false);
  });

  it('still blocks a trigger just before the window elapses', () => {
    const clock = makeClock();
    const cache = createSenderTriggerCache({ windowMs: 1000, now: clock.now });

    cache.checkAndRecord(makeInput({}));
    clock.advance(999);

    expect(cache.checkAndRecord(makeInput({}))).toBe(true);
  });

  it('defaults to a 15-minute window when no options are given (BUILD_PLAN 5.3a, Alex settled)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T09:00:00.000Z'));
    try {
      const cache = createSenderTriggerCache();

      cache.checkAndRecord(makeInput({}));
      vi.advanceTimersByTime(15 * 60 * 1000);

      expect(cache.checkAndRecord(makeInput({}))).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
