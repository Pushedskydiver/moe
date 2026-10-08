import { describe, expect, it } from 'vitest';

import { haikuCostUsdMicros } from '../model-pricing.js';
import { evalCostUsdMicros } from './eval-pricing.js';

describe('evalCostUsdMicros', () => {
  it("prices Haiku 4.5 through production's own haikuCostUsdMicros, $1 and $5 per MTok", () => {
    const usage = { inputTokens: 1_000, outputTokens: 200 };

    expect(evalCostUsdMicros('claude-haiku-4-5', usage)).toBe(
      haikuCostUsdMicros(usage),
    );
    expect(evalCostUsdMicros('claude-haiku-4-5', usage)).toBe(2_000);
  });

  it('prices Haiku 5.5 at $0.10 input and $0.50 output per MTok, a tenth of Haiku 4.5', () => {
    expect(
      evalCostUsdMicros('claude-haiku-5-5', {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBeCloseTo(600_000, 6);
  });
});
