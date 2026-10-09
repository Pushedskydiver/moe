import { describe, expect, it } from 'vitest';

import { haikuCostUsdMicros } from '../model-pricing.js';
import { evalCostUsdMicros } from './eval-pricing.js';

describe('evalCostUsdMicros', () => {
  it("prices Haiku 4.5 at $1 input and $5 output per MTok, the rate production's haikuCostUsdMicros held before BUILD_PLAN 3.14", () => {
    const usage = { inputTokens: 1_000, outputTokens: 200 };

    expect(evalCostUsdMicros('claude-haiku-4-5', usage)).toBe(2_000);
  });

  it("agrees with production's haikuCostUsdMicros for Haiku 5.5 on a usage where rounding changes nothing", () => {
    const usage = { inputTokens: 1_000, outputTokens: 500 };

    expect(evalCostUsdMicros('claude-haiku-5-5', usage)).toBe(
      haikuCostUsdMicros(usage),
    );
    expect(haikuCostUsdMicros(usage)).toBe(350);
  });

  it('prices Haiku 5.5 at $0.10 input and $0.50 output per MTok, its rate for prompts of 100K tokens or fewer and a tenth of Haiku 4.5', () => {
    expect(
      evalCostUsdMicros('claude-haiku-5-5', {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBeCloseTo(600_000, 6);
  });
});
