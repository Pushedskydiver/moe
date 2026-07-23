import type { WipLimitsConfig } from './wip-limits-config.js';

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { evaluateWipLimit } from './wip-limit-guard.js';
import { DEFAULT_WIP_LIMITS } from './wip-limits-config.js';

describe('evaluateWipLimit', () => {
  it('allows a pull when the current count is below the limit', () => {
    const result = evaluateWipLimit('Brief', 2, DEFAULT_WIP_LIMITS);
    expect(result).toEqual({ allowed: true, reason: 'under-limit' });
  });

  it('blocks a pull when the current count is at the limit', () => {
    const result = evaluateWipLimit('Brief', 3, DEFAULT_WIP_LIMITS);
    expect(result).toEqual({ allowed: false, reason: 'at-limit' });
  });

  it('blocks a pull when the current count is above the limit', () => {
    const result = evaluateWipLimit('Build', 5, DEFAULT_WIP_LIMITS);
    expect(result).toEqual({ allowed: false, reason: 'at-limit' });
  });

  it('always allows a pull into an uncapped status (Backlog), regardless of count', () => {
    const result = evaluateWipLimit('Backlog', 999, DEFAULT_WIP_LIMITS);
    expect(result).toEqual({ allowed: true, reason: 'uncapped-status' });
  });

  it('always allows a pull into an uncapped status (Done), regardless of count', () => {
    const result = evaluateWipLimit('Done', 999, DEFAULT_WIP_LIMITS);
    expect(result).toEqual({ allowed: true, reason: 'uncapped-status' });
  });

  it('always allows a pull into an uncapped status (Cancelled), regardless of count', () => {
    const result = evaluateWipLimit('Cancelled', 999, DEFAULT_WIP_LIMITS);
    expect(result).toEqual({ allowed: true, reason: 'uncapped-status' });
  });

  it.each([
    ['Brief', 3],
    ['Plan', 2],
    ['Build', 2],
    ['Review', 2],
  ] as const)(
    'defaults %s to a WIP limit of %i (BOARD-AND-CAPACITY-MODEL.md)',
    (status, limit) => {
      expect(DEFAULT_WIP_LIMITS[status]).toBe(limit);
    },
  );

  it('accepts a caller-supplied config, overriding the default limits', () => {
    const customLimits: WipLimitsConfig = {
      ...DEFAULT_WIP_LIMITS,
      Brief: 1,
    };
    const result = evaluateWipLimit('Brief', 1, customLimits);
    expect(result).toEqual({ allowed: false, reason: 'at-limit' });
  });

  it('property: for any capped status, a count at or above its limit is always blocked', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Brief', 'Plan', 'Build', 'Review'),
        fc.nat({ max: 50 }),
        (status, extra) => {
          const limit = DEFAULT_WIP_LIMITS[status];
          if (limit === null) throw new Error('unreachable — status is capped');
          const result = evaluateWipLimit(status, limit + extra);
          expect(result.allowed).toBe(false);
        },
      ),
    );
  });

  it('property: for any capped status, a count below its limit is always allowed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Brief', 'Plan', 'Build', 'Review'),
        (status) => {
          const limit = DEFAULT_WIP_LIMITS[status];
          if (limit === null) throw new Error('unreachable — status is capped');
          fc.pre(limit > 0);
          const result = evaluateWipLimit(status, limit - 1);
          expect(result.allowed).toBe(true);
        },
      ),
    );
  });
});
