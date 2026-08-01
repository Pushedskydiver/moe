import { describe, expect, it } from 'vitest';

import { haikuCostUsdMicros, sonnetCostUsdMicros } from './model-pricing.js';

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

  it('prices cache-creation (write) tokens at 1.25x the introductory input rate (BUILD_PLAN 5.3a-ii)', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 1_000 },
      new Date('2026-07-17T09:00:00.000Z'),
    );

    // 1_000 * (2 * 1.25) = 2_500 micro-USD
    expect(cost).toBe(2_500);
  });

  it('prices cache-read tokens at 0.1x the introductory input rate', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 1_000 },
      new Date('2026-07-17T09:00:00.000Z'),
    );

    // 1_000 * (2 * 0.1) = 200 micro-USD
    expect(cost).toBe(200);
  });

  it('prices cache tokens at the standard rate after the cutover, alongside plain input/output', () => {
    const cost = sonnetCostUsdMicros(
      {
        inputTokens: 100,
        outputTokens: 0,
        cacheCreationInputTokens: 1_000,
        cacheReadInputTokens: 1_000,
      },
      new Date('2027-01-01T00:00:00.000Z'),
    );

    // 100 * 3 + 1_000 * (3 * 1.25) + 1_000 * (3 * 0.1) = 300 + 3_750 + 300 = 4_350 micro-USD
    expect(cost).toBe(4_350);
  });

  it('rounds a fractional cache-token total to the nearest whole micro-USD (personaCostUsageSchema stores an int)', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 0, outputTokens: 0, cacheCreationInputTokens: 3 },
      new Date('2026-07-17T09:00:00.000Z'),
    );

    // 3 * 2.5 = 7.5, rounds to 8
    expect(cost).toBe(8);
    expect(Number.isInteger(cost)).toBe(true);
  });

  it('treats omitted cache fields as zero, matching pre-caching behavior exactly', () => {
    const cost = sonnetCostUsdMicros(
      { inputTokens: 1_000, outputTokens: 500 },
      new Date('2026-07-17T09:00:00.000Z'),
    );

    expect(cost).toBe(7_000);
  });
});

describe('haikuCostUsdMicros', () => {
  it('prices at the flat $1/$5-per-MTok rate', () => {
    const cost = haikuCostUsdMicros({ inputTokens: 1_000, outputTokens: 500 });

    // 1_000 * 1 + 500 * 5 = 3_500 micro-USD
    expect(cost).toBe(3_500);
  });

  it('returns zero for a zero-token call', () => {
    const cost = haikuCostUsdMicros({ inputTokens: 0, outputTokens: 0 });

    expect(cost).toBe(0);
  });
});
