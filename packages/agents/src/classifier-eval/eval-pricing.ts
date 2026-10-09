import type { EvalModel } from './eval-configurations.js';

// claude-haiku-4-5: $1 input and $5 output per MTok, the rate production's `haikuCostUsdMicros`
// held until BUILD_PLAN 3.14 moved it to Haiku 5.5's. The eval's baseline column still needs it,
// so the eval holds it itself.
const HAIKU_4_5_PRICING = { inputMicrosPerToken: 1, outputMicrosPerToken: 5 };

// claude-haiku-5-5: $0.10 input and $0.50 output per MTok (BUILD_PLAN 3.13), its rate for a
// prompt of 100K tokens or fewer, which every eval prompt is (above that, $0.50 and $2.50). 1 USD
// per MTok is 1 micro-USD per token, so these are fractional micros per token — the eval keeps
// them as floats rather than rounding each call, since a single call costs only about a hundred
// micros. Production's `haikuCostUsdMicros` holds the same rate and rounds its total (3.14); a
// test here keeps the two rates equal.
const HAIKU_5_5_PRICING = {
  inputMicrosPerToken: 0.1,
  outputMicrosPerToken: 0.5,
};

/**
 * One call's cost in micro-USD, each model at its own prices above. Thinking tokens are inside
 * `outputTokens` (the API's `output_tokens` is the billed total), so they're priced as output.
 */
export function evalCostUsdMicros(
  model: EvalModel,
  usage: { readonly inputTokens: number; readonly outputTokens: number },
): number {
  const pricing =
    model === 'claude-haiku-4-5' ? HAIKU_4_5_PRICING : HAIKU_5_5_PRICING;

  return (
    usage.inputTokens * pricing.inputMicrosPerToken +
    usage.outputTokens * pricing.outputMicrosPerToken
  );
}
