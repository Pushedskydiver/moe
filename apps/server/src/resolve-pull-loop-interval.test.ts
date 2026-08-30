import { describe, expect, it } from 'vitest';

import { resolvePullLoopIntervalMs } from './resolve-pull-loop-interval.js';

describe('resolvePullLoopIntervalMs', () => {
  it('defaults to 60000 when MOE_PULL_LOOP_INTERVAL_MS is unset', () => {
    expect(resolvePullLoopIntervalMs({})).toBe(60_000);
  });

  it('uses MOE_PULL_LOOP_INTERVAL_MS when it is a valid number at or above the floor', () => {
    expect(
      resolvePullLoopIntervalMs({ MOE_PULL_LOOP_INTERVAL_MS: '5000' }),
    ).toBe(5000);
  });

  it('falls back to the default when MOE_PULL_LOOP_INTERVAL_MS is not a number', () => {
    expect(
      resolvePullLoopIntervalMs({
        MOE_PULL_LOOP_INTERVAL_MS: 'not-a-number',
      }),
    ).toBe(60_000);
  });

  it('falls back to the default when MOE_PULL_LOOP_INTERVAL_MS is below the 1000ms floor', () => {
    expect(resolvePullLoopIntervalMs({ MOE_PULL_LOOP_INTERVAL_MS: '0' })).toBe(
      60_000,
    );
    expect(
      resolvePullLoopIntervalMs({ MOE_PULL_LOOP_INTERVAL_MS: '-1000' }),
    ).toBe(60_000);
  });
});
