import { describe, expect, it } from 'vitest';

import { sonnetCostUsdMicros } from './model-pricing.js';

describe('sonnetCostUsdMicros', () => {
  it('prices at the introductory $2/$10-per-MTok rate before the 2026-08-31 cutover', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 1_000, outputTokens: 500 },
      new Date('2026-07-17T09:00:00.000Z'),
    );

    // 1_000 * 2 + 500 * 10 = 7_000 micro-USD ($0.007)
    expect(cost).toBe(7_000);
  });

  it('still uses introductory pricing on the last covered instant', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 1_000, outputTokens: 0 },
      new Date('2026-08-31T23:59:59.999Z'),
    );

    expect(cost).toBe(2_000);
  });

  it('switches to the standard $3/$15-per-MTok rate exactly at the cutover instant', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 1_000, outputTokens: 500 },
      new Date('2026-09-01T00:00:00.000Z'),
    );

    // 1_000 * 3 + 500 * 15 = 10_500 micro-USD
    expect(cost).toBe(10_500);
  });

  it('uses standard pricing well after the cutover', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 1_000, outputTokens: 0 },
      new Date('2027-01-01T00:00:00.000Z'),
    );

    expect(cost).toBe(3_000);
  });

  it('returns zero for a zero-token turn', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 0, outputTokens: 0 },
      new Date('2026-07-17T09:00:00.000Z'),
    );

    expect(cost).toBe(0);
  });
});
